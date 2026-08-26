const { ChannelType } = require('discord.js');
const fs = require('fs-extra');

async function restoreBackup(guild, backup) {
  const roleMap = new Map();
  const categoryMap = new Map();
  const channelMap = new Map();

  // Roles first. @everyone is never recreated.
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

  // Categories are created first and mapped by backup ID.
  const categories = [...(backup.categories || [])].sort((a, b) => a.order - b.order);
  for (const data of categories) {
    let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === data.name);
    if (!category) {
      category = await guild.channels.create({ name: data.name, type: ChannelType.GuildCategory });
    }
    categoryMap.set(data.id, category);
    channelMap.set(data.id, category);
  }

  // Create channels and attach them to the correct category before positioning.
  const channels = [...(backup.channels || [])];
  for (const data of channels) {
    const parent = data.parentId ? categoryMap.get(data.parentId) : null;
    let channel = guild.channels.cache.find(c => c.type === data.type && c.name === data.name && (c.parentId || null) === (parent?.id || null));

    if (!channel) {
      channel = await guild.channels.create({
        name: data.name,
        type: data.type,
        parent: parent?.id,
        topic: data.topic ?? undefined,
        nsfw: data.nsfw ?? false,
        rateLimitPerUser: data.rateLimitPerUser ?? 0
      });
    } else if ((channel.parentId || null) !== (parent?.id || null)) {
      await channel.setParent(parent?.id || null, { lockPermissions: false });
    }

    channelMap.set(data.id, channel);
  }

  // Category order: apply globally, after every category exists.
  const categoryPositions = categories
    .map(data => ({ channel: categoryMap.get(data.id)?.id, position: data.order }))
    .filter(x => x.channel);
  if (categoryPositions.length) await guild.channels.setPositions(categoryPositions);

  // Channel order is relative to each parent. Discord recalculates positions after moving a channel,
  // so process each group from highest saved position to lowest.
  const groups = new Map();
  for (const data of channels) {
    const key = data.parentId || '__ROOT__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(data);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.position - b.position);
    const positions = group
      .map((data, index) => ({ channel: channelMap.get(data.id)?.id, position: index }))
      .filter(x => x.channel);
    if (positions.length) await guild.channels.setPositions(positions);
  }

  return {
    roles: roleMap.size,
    categories: categoryMap.size,
    channels: channelMap.size - categoryMap.size
  };
}

async function restoreFromFile(guild, filePath) {
  const backup = await fs.readJson(filePath);
  return restoreBackup(guild, backup);
}

module.exports = { restoreBackup, restoreFromFile };