const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");
const { getServerFolder } = require("./storage");

async function isAdminInGuild(guild, userId) {
    try {
        let member = guild.members.cache.get(userId);
        if (!member) member = await guild.members.fetch(userId);
        return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
    }
    catch {
        return false;
    }
}

async function getAccessibleBackups(client, userId) {
    const result = [];

    for (const guild of client.guilds.cache.values()) {
        if (!(await isAdminInGuild(guild, userId))) continue;

        const folder = getServerFolder(guild);
        if (!fs.existsSync(folder)) continue;

        let files = [];
        try {
            files = fs.readdirSync(folder).filter(file => file.endsWith(".json"));
        }
        catch {
            continue;
        }

        for (const file of files) {
            const filePath = path.join(folder, file);
            try {
                const backup = JSON.parse(fs.readFileSync(filePath, "utf8"));
                if (!backup?.id) continue;

                result.push({
                    id: backup.id,
                    filePath,
                    guild,
                    guildId: guild.id,
                    guildName: guild.name,
                    createdAt: backup.createdAt || null,
                    backup
                });
            }
            catch {
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

    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];

    return matches[0];
}

module.exports = {
    isAdminInGuild,
    getAccessibleBackups,
    findAccessibleBackup
};
