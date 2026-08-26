const { ChannelType } = require('discord.js');
const fs = require('fs-extra');

function sameRole(role, data) {
  return role.name === data.name &&
    role.color === data.color &&
    role.hoist === Boolean(data.hoist) &&
    role.mentionable === Boolean(data.mentionable) &&
    role.permissions.bitfield.toString() === String(data.permissions || '0');
}

function sameChannel(channel, data, parentId) {
  const topic = 'topic' in channel ? channel.topic : null;
  const nsfw = 'nsfw' in channel ? channel.nsfw : false;
  const rateLimit = 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0;

  return channel.name === data.name &&
    channel.type === data.type &&
    (channel.parentId || null) === (parentId || null) &&
    topic === (data.topic ?? null) &&
    nsfw === Boolean(data.nsfw ?? false) &&
    rateLimit === Number(data.rateLimitPerUser ?? 0);
}

async function restoreBackup(guild, backup) {
  const roleMap = new Map();
  const categoryMap = new Map();
  const channelMap = new Map();

  const reason = `SkyRush Backup restore ${backup.id}`;
  const syncReason = `SkyRush Backup sync ${backup.id}`;

  // Roles: match by name first. If the role exists but its settings differ,
  // update it instead of creating a duplicate role.
  const roles = [...(backup.roles || [])].sort(
    (a, b) => (a.order ?? a.position) - (b.order ?? b.position)
  );

  for (const data of roles) {
    let role = guild.roles.cache.find(r => r.name === data.name);

    if (!role) {
      role = await guild.roles.create({
        name: data.name,
        color: data.color,
        hoist: Boolean(data.hoist),
        mentionable: Boolean(data.mentionable),
        permissions: BigInt(data.permissions || '0'),
        reason
      });
    } else if (!sameRole(role, data)) {
      await role.edit({
        name: data.name,
        color: data.color,
        hoist: Boolean(data.hoist),
        mentionable: Boolean(data.mentionable),
        permissions: BigInt(data.permissions || '0'),
        reason: syncReason
      });
    }

    roleMap.set(data.id, role);
  }

  // Categories: match by name, regardless of their current position.
  // Existing categories are reused; only missing categories are created.
  const categories = [...(backup.categories || [])].sort(
    (a, b) => (a.order ?? a.position) - (b.order ?? b.position)
  );

  for (const data of categories) {
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === data.name
    );

    if (!category) {
      category = await guild.channels.create({
        name: data.name,
        type: ChannelType.GuildCategory,
        reason
      });
    }

    categoryMap.set(data.id, category);
    channelMap.set(data.id, category);
  }

  // Channels: match by type + name first, then synchronize their parent and
  // other saved properties. This prevents duplicates when the same channel
  // was moved to another category after the backup was created.
  const channels = [...(backup.channels || [])]
    .filter(c => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));

  for (const data of channels) {
    const parent = data.parentId ? categoryMap.get(data.parentId) : null;

    let channel = guild.channels.cache.find(
      c => c.type === data.type && c.name === data.name
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: data.name,
        type: data.type,
        parent: parent?.id,
        topic: data.topic ?? undefined,
        nsfw: Boolean(data.nsfw ?? false),
        rateLimitPerUser: Number(data.rateLimitPerUser ?? 0),
        reason
      });
    } else {
      const patch = {};
      const targetTopic = data.topic ?? null;
      const targetNsfw = Boolean(data.nsfw ?? false);
      const targetRateLimit = Number(data.rateLimitPerUser ?? 0);

      if (channel.name !== data.name) patch.name = data.name;
      if ('topic' in channel && channel.topic !== targetTopic) patch.topic = targetTopic;
      if ('nsfw' in channel && channel.nsfw !== targetNsfw) patch.nsfw = targetNsfw;
      if ('rateLimitPerUser' in channel && channel.rateLimitPerUser !== targetRateLimit) {
        patch.rateLimitPerUser = targetRateLimit;
      }

      if (Object.keys(patch).length) {
        await channel.edit({ ...patch, reason: syncReason });
      }

      const targetParentId = parent?.id || null;
      if ((channel.parentId || null) !== targetParentId) {
        await channel.setParent(targetParentId, {
          lockPermissions: false,
          reason: syncReason
        });
      }

      // sameChannel is intentionally evaluated after the synchronization above
      // so this path also handles channels that already match perfectly.
      sameChannel(channel, data, targetParentId);
    }

    channelMap.set(data.id, channel);
  }

  // Restore category order.
  const categoryPositions = categories
    .map((data, index) => ({
      channel: categoryMap.get(data.id)?.id,
      position: index
    }))
    .filter(x => x.channel);

  if (categoryPositions.length) {
    await guild.channels.setPositions(categoryPositions);
  }

  // Restore channel order inside each category/root group.
  const groups = new Map();
  for (const data of channels) {
    const key = data.parentId || '__ROOT__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(data);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));

    const positions = group
      .map((data, index) => ({
        channel: channelMap.get(data.id)?.id,
        position: index
      }))
      .filter(x => x.channel);

    if (positions.length) {
      await guild.channels.setPositions(positions);
    }
  }

  // Restore role order.
  const rolePositions = roles
    .map((data, index) => ({
      role: roleMap.get(data.id)?.id,
      position: roles.length - index
    }))
    .filter(x => x.role);

  if (rolePositions.length) {
    await guild.roles.setPositions(rolePositions);
  }

  return {
    roles: roleMap.size,
    categories: categoryMap.size,
    channels: channelMap.size - categoryMap.size
  };
}

async function restoreFromFile(guild, filePath) {
  return restoreBackup(guild, await fs.readJson(filePath));
}

module.exports = { restoreBackup, restoreFromFile };