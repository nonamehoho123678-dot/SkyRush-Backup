const { ChannelType } = require('discord.js');
const fs = require('fs-extra');

async function restoreBackup(guild, backup) {
  const roleMap = new Map();
  const channelMap = new Map();

  // Roles: create first, then apply their saved order.
  const roles = [...(backup.roles || [])].sort((a, b) => a.position - b.position);
  for (const data of roles) {
    let role = guild.roles.cache.find(r => r.name === data.name);
    if (!role) {
      role = await guild.roles.create({
        name: data.name,
        color: data.color,
        hoist: data.hoist,
        mentionable: data.mentionable,
        permissions: BigInt(data.permissions || '0'),
        reason: `SkyRush Backup restore ${backup.id}`
      });
    }
    roleMap.set(data.id, role);
  }

  // Categories must exist before their child channels.
  const channels = [...(backup.channels || [])];
  const categories = channels
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const data of categories) {
    let channel = guild.channels.cache.find(c => c.name === data.name && c.type === ChannelType.GuildCategory);
    if (!channel) {
      channel = await guild.channels.create({ name: data.name, type: ChannelType.GuildCategory });
    }
    channelMap.set(data.id, channel);
  }

  // Create non-category channels while preserving parent relationships.
  const children = channels
    .filter(c => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const data of children) {
    let channel = guild.channels.cache.find(c => c.name === data.name && c.type === data.type);
    const parent = data.parentId ? channelMap.get(data.parentId) : null;

    if (!channel) {
      const options = {
        name: data.name,
        type: data.type,
        parent: parent?.id,
        topic: data.topic ?? undefined,
        nsfw: data.nsfw ?? false
      };
      channel = await guild.channels.create(options);
    } else if (parent && channel.parentId !== parent.id) {
      await channel.setParent(parent.id, { lockPermissions: false });
    }

    channelMap.set(data.id, channel);
  }

  // Discord calculates positions after creation/parent changes, so positions are applied last.
  const grouped = new Map();
  for (const data of channels) {
    const channel = channelMap.get(data.id);
    if (!channel) continue;
    const key = data.parentId || 'root';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ channel, position: data.position });
  }

  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.position - b.position);
    const positions = entries.map((entry, index) => ({
      channel: entry.channel.id,
      position: index
    }));
    if (positions.length) await guild.channels.setPositions(positions);
  }

  return { roles: roleMap.size, channels: channelMap.size };
}

async function restoreFromFile(guild, filePath) {
  const backup = await fs.readJson(filePath);
  return restoreBackup(guild, backup);
}

module.exports = { restoreBackup, restoreFromFile };
