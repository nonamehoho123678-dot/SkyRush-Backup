const crypto = require('crypto');
const { run, get } = require('./database');
const { createBackup } = require('./backupManager');

async function ensurePasswordColumn() {
  try { await run(`ALTER TABLE settings ADD COLUMN clear_password_hash TEXT`); }
  catch (error) { if (!String(error.message).includes('duplicate column name')) throw error; }
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex'); const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function setClearPassword(guildId, password) {
  await ensurePasswordColumn();
  await run(`INSERT OR IGNORE INTO settings (guild_id) VALUES (?)`, [guildId]);
  await run(`UPDATE settings SET clear_password_hash = ? WHERE guild_id = ?`, [hashPassword(password), guildId]);
}
async function checkClearPassword(guildId, password) {
  await ensurePasswordColumn();
  const settings = await get(`SELECT clear_password_hash FROM settings WHERE guild_id = ?`, [guildId]);
  return verifyPassword(password, settings?.clear_password_hash);
}
async function clearServer(guild, user) {
  const backup = await createBackup(guild, user, 'SR');
  const errors = [];
  let deletedChannels = 0; let deletedRoles = 0;
  const channels = [...guild.channels.cache.values()].sort((a, b) => b.rawPosition - a.rawPosition);
  for (const channel of channels) {
    try { await channel.delete('SkyRush Backup: server clear'); deletedChannels++; }
    catch { errors.push(`channel:${channel.id}`); }
  }
  const botMember = guild.members.me;
  const roles = [...guild.roles.cache.values()]
    .filter(role => role.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  for (const role of roles) {
    try {
      if (botMember && role.position >= botMember.roles.highest.position) { errors.push(`role:${role.id}`); continue; }
      await role.delete('SkyRush Backup: server clear'); deletedRoles++;
    } catch { errors.push(`role:${role.id}`); }
  }
  return { backup, deletedChannels, deletedRoles, errors };
}
module.exports = { ensurePasswordColumn, setClearPassword, checkClearPassword, clearServer };