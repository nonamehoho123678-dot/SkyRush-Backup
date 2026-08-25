const fs = require('fs-extra');
const path = require('path');
const { run, all, get } = require('./database');
const { createBackupId } = require('./backupID');

const backupRoot = path.join(process.cwd(), 'backups');
fs.ensureDirSync(backupRoot);

async function createBackup(guild, user, prefix = 'SR') {
  const id = await createBackupId(prefix);
  const dir = path.join(backupRoot, id);
  await fs.ensureDir(dir);

  const data = {
    id,
    guild: {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      iconURL: guild.iconURL()
    },
    roles: guild.roles.cache.filter(r => r.id !== guild.id).map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      hoist: r.hoist,
      mentionable: r.mentionable
    })),
    channels: guild.channels.cache.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      position: c.position,
      topic: 'topic' in c ? c.topic : null,
      nsfw: 'nsfw' in c ? c.nsfw : false
    })),
    createdAt: new Date().toISOString()
  };

  const filePath = path.join(dir, 'backup.json');
  await fs.writeJson(filePath, data, { spaces: 2 });

  await run(
    `INSERT INTO backups (id, guild_id, guild_name, created_at, created_by, file_path) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, guild.id, guild.name, data.createdAt, user.id, filePath]
  );

  return data;
}

async function listBackups(guildId) {
  return all(`SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC`, [guildId]);
}

async function getBackup(id, guildId) {
  return get(`SELECT * FROM backups WHERE id = ? AND guild_id = ?`, [id, guildId]);
}

async function deleteBackup(id, guildId) {
  const backup = await getBackup(id, guildId);
  if (!backup) return false;
  await fs.remove(path.dirname(backup.file_path));
  await run(`DELETE FROM backups WHERE id = ? AND guild_id = ?`, [id, guildId]);
  return true;
}

async function pruneBackups(guildId, maxBackups) {
  const backups = await listBackups(guildId);
  for (const backup of backups.slice(maxBackups)) {
    await deleteBackup(backup.id, guildId);
  }
}

module.exports = { createBackup, listBackups, getBackup, deleteBackup, pruneBackups };
