const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");
const { getServerFolder } = require("./storage");

const userDataFolder = path.join(__dirname, "..", "..", "data");
const hiddenFile = path.join(userDataFolder, "hiddenBackups.json");

function ensureUserData() {
    fs.mkdirSync(userDataFolder, { recursive: true });
    if (!fs.existsSync(hiddenFile)) fs.writeFileSync(hiddenFile, "{}", "utf8");
}
function readHidden() {
    ensureUserData();
    try { const data = JSON.parse(fs.readFileSync(hiddenFile, "utf8")); return data && typeof data === "object" ? data : {}; }
    catch { return {}; }
}
function writeHidden(data) { ensureUserData(); fs.writeFileSync(hiddenFile, JSON.stringify(data, null, 2), "utf8"); }
function isHidden(userId, guildId, backupId) { return Boolean(readHidden()[userId]?.[guildId]?.includes(backupId)); }
function hideBackupForUser(userId, guildId, backupId) {
    const hidden = readHidden();
    if (!hidden[userId]) hidden[userId] = {};
    if (!hidden[userId][guildId]) hidden[userId][guildId] = [];
    if (!hidden[userId][guildId].includes(backupId)) hidden[userId][guildId].push(backupId);
    writeHidden(hidden);
}
function unhideBackupForUser(userId, guildId, backupId) {
    const hidden = readHidden();
    if (!hidden[userId]?.[guildId]) return;
    hidden[userId][guildId] = hidden[userId][guildId].filter(id => id !== backupId);
    if (!hidden[userId][guildId].length) delete hidden[userId][guildId];
    if (!Object.keys(hidden[userId]).length) delete hidden[userId];
    writeHidden(hidden);
}

async function isAdminInGuild(guild, userId) {
    try {
        let member = guild.members.cache.get(userId);
        if (!member) member = await guild.members.fetch(userId);
        return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
    } catch { return false; }
}

async function getAccessibleBackups(client, userId, options = {}) {
    const includeHidden = Boolean(options.includeHidden);
    const result = [];

    for (const guild of client.guilds.cache.values()) {
        const admin = await isAdminInGuild(guild, userId);
        const folder = getServerFolder(guild);
        if (!fs.existsSync(folder)) continue;

        let files;
        try { files = fs.readdirSync(folder).filter(file => file.endsWith(".json")); }
        catch { continue; }

        for (const file of files) {
            const filePath = path.join(folder, file);
            try {
                const backup = JSON.parse(fs.readFileSync(filePath, "utf8"));
                if (!backup?.id) continue;

                // Người tạo được xem backup của chính mình.
                // Admin của server được xem tất cả backup của server đó.
                const owner = String(backup.createdBy || "");
                if (!admin && owner !== String(userId)) continue;

                const hidden = isHidden(userId, guild.id, backup.id);
                if (hidden && !includeHidden) continue;

                result.push({
                    id: backup.id,
                    filePath,
                    guild,
                    guildId: guild.id,
                    guildName: guild.name,
                    createdAt: backup.createdAt || null,
                    createdBy: backup.createdBy || null,
                    backup,
                    hidden
                });
            } catch { /* bỏ qua backup hỏng */ }
        }
    }

    result.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return result;
}

async function findAccessibleBackup(client, userId, id) {
    const backups = await getAccessibleBackups(client, userId);
    return backups.find(item => item.id === id) || null;
}

module.exports = { isAdminInGuild, getAccessibleBackups, findAccessibleBackup, hideBackupForUser, unhideBackupForUser, isHidden };
