const { ChannelType } = require('discord.js');
const fs = require('fs-extra');

function sameRole(role, data) {
  return role.name === data.name && role.color === data.color && role.hoist === data.hoist && role.mentionable === data.mentionable && role.permissions.bitfield.toString() === String(data.permissions || '0');
}

function sameChannel(channel, data, parentId) {
  const topic = 'topic' in channel ? channel.topic : null;
  const nsfw = 'nsfw' in channel ? channel.nsfw : false;
  const rateLimit = 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0;
  return channel.name === data.name && channel.type === data.type && (channel.parentId || null) === (parentId || null) && topic === (data.topic ?? null) && nsfw === Boolean(data.nsfw ?? false) && rateLimit === Number(data.rateLimitPerUser ?? 0);
}

async function restoreBackup(guild, backup) {
  const roleMap = new Map();
  const categoryMap = new Map();
  const channelMap = new Map();

  const roles = [...(backup.roles || [])].sort((a, b) => (a.order ?? a.position) - (b.order ?? b.position));
  for (const data of roles) {
    let role = guild.roles.cache.find(r => r.name === data.name);
    if (!role) {
      role = await guild.roles.create({ name: data.name, color: data.color, hoist: data.hoist, mentionable: data.mentionable, permissions: BigInt(data.permissions || '0'), reason: `SkyRush Backup restore ${backup.id}` });
    } else if (!sameRole(role, data)) {
      await role.edit({ color: data.color, hoist: data.hoist, mentionable: data.mentionable, permissions: BigInt(data.permissions || '0'), reason: `SkyRush Backup sync ${backup.id}` });
    }
    roleMap.set(data.id, role);
  }

  const categories = [...(backup.categories || [])].sort((a, b) => (a.order ?? a.position) - (b.order ?? b.position));
  for (const data of categories) {
    let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === data.name);
    if (!category) {
      category = await guild.channels.create({ name: data.name, type: ChannelType.GuildCategory, reason: `SkyRush Backup restore ${backup.id}` });
    }
    categoryMap.set(data.id, category);
    channelMap.set(data.id, category);
  }

  const channels = [...(backup.channels || [])].filter(c => c.type !== ChannelType.GuildCategory);
  for (const data of channels) {
    const parent = data.parentId ? categoryMap.get(data.parentId) : null;
    let channel = guild.channels.cache.find(c => c.type === data.type && c.name === data.name && (c.parentId || null) === (parent?.id || null));

    if (!channel) {
      channel = await guild.channels.create({ name: data.name, type: data.type, parent: parent?.id, topic: data.topic ?? undefined, nsfw: data.nsfw ?? false, rateLimitPerUser: data.rateLimitPerUser ?? 0, reason: `SkyRush Backup restore ${backup.id}` });
    } else {
      const patch = {};
      if (!sameChannel(channel, data, parent?.id)) {
        if (channel.name !== data.name) patch.name = data.name;
        if ('topic' in channel && channel.topic !== (data.topic ?? null)) patch.topic = data.topic ?? null;
        if ('nsfw' in channel && channel.nsfw !== Boolean(data.nsfw ?? false)) patch.nsfw = Boolean(data.nsfw ?? false);
        if ('rateLimitPerUser' in channel && channel.rateLimitPerUser !== Number(data.rateLimitPerUser ?? 0)) patch.rateLimitPerUser = Number(data.rateLimitPerUser ?? 0);
        if (Object.keys(patch).length) await channel.edit({ ...patch, reason: `SkyRush Backup sync ${backup.id}` });
        if ((channel.parentId || null) !== (parent?.id || null)) await channel.setParent(parent?.id || null, { lockPermissions: false, reason: `SkyRush Backup sync ${backup.id}` });
      }
    }
    channelMap.set(data.id, channel);
  }

  const categoryPositions = categories.map((data, index) => ({ channel: categoryMap.get(data.id)?.id, position: index })).filter(x => x.channel);
  if (categoryPositions.length) await guild.channels.setPositions(categoryPositions);

  const groups = new Map();
  for (const data of channels) {
    const key = data.parentId || '__ROOT__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(data);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.position ?? a.order) - (b.position ?? b.order));
    const positions = group.map((data, index) => ({ channel: channelMap.get(data.id)?.id, position: index })).filter(x => x.channel);
    if (positions.length) await guild.channels.setPositions(positions);
  }

  const rolePositions = roles.map((data, index) => ({ role: roleMap.get(data.id)?.id, position: roles.length - index })).filter(x => x.role);
  if (rolePositions.length) await guild.roles.setPositions(rolePositions);

  return { roles: roleMap.size, categories: categoryMap.size, channels: channelMap.size - categoryMap.size };
}

async function restoreFromFile(guild, filePath) {
  return restoreBackup(guild, await fs.readJson(filePath));
}

module.exports = { restoreBackup, restoreFromFile };