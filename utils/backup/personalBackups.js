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
    try {
        const data = JSON.parse(fs.readFileSync(hiddenFile, "utf8"));
        return data && typeof data === "object" ? data : {};
    } catch {
        return {};
    }
}

function writeHidden(data) {
    ensureUserData();
    fs.writeFileSync(hiddenFile, JSON.stringify(data, null, 2), "utf8");
}

function isHidden(userId, guildId, backupId) {
    const hidden = readHidden();
    return Boolean(hidden[userId]?.[guildId]?.includes(backupId));
}

function hideBackupForUser(userId, guildId, backupId) {
    const hidden = readHidden();
    if (!hidden[userId]) hidden[userId] = {};
    if (!hidden[userId][guildId]) hidden[userId][guildId] = [];
    if (!hidden[userId][guildId].includes(backupId)) {
        hidden[userId][guildId].push(backupId);
        writeHidden(hidden);
    }
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
    } catch {
        return false;
    }
}

async function getAccessibleBackups(client, userId, options = {}) {
    const includeHidden = Boolean(options.includeHidden);
    const result = [];

    for (const guild of client.guilds.cache.values()) {
        if (!(await isAdminInGuild(guild, userId))) continue;

        const folder = getServerFolder(guild);
        if (!fs.existsSync(folder)) continue;

        let files = [];
        try {
            files = fs.readdirSync(folder).filter(file => file.endsWith(".json"));
        } catch {
            continue;
        }

        for (const file of files) {
            const filePath = path.join(folder, file);
            try {
                const backup = JSON.parse(fs.readFileSync(filePath, "utf8"));
                if (!backup?.id) continue;

                const hidden = isHidden(userId, guild.id, backup.id);
                if (hidden && !includeHidden) continue;

                result.push({
                    id: backup.id,
                    filePath,
                    guild,
                    guildId: guild.id,
                    guildName: guild.name,
                    createdAt: backup.createdAt || null,
                    backup,
                    hidden
                });
            } catch {
                // Bỏ qua file backup hỏng.
            }
        }
    }

    result.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return result;
}

async function findAccessibleBackup(client, userId, id) {
    const backups = await getAccessibleBackups(client, userId);
    const matches = backups.filter(item => item.id === id);
    return matches.length ? matches[0] : null;
}

module.exports = {
    isAdminInGuild,
    getAccessibleBackups,
    findAccessibleBackup,
    hideBackupForUser,
    unhideBackupForUser,
    isHidden
};
