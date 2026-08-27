const fs = require("fs");
const path = require("path");

const backupRoot = path.join(__dirname, "..", "..", "backups");

function sanitizeServerName(name) {
    return String(name || "server")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "server";
}

function getServerFolder(guild) {
    if (!guild?.id) throw new Error("Guild không tồn tại.");
    return path.join(backupRoot, `${sanitizeServerName(guild.name)}_${guild.id}`);
}

function ensureServerFolder(guild) {
    const folder = getServerFolder(guild);
    fs.mkdirSync(folder, { recursive: true });
    return folder;
}

function getBackupFile(guild, id) {
    return path.join(getServerFolder(guild), `${id}.json`);
}

module.exports = {
    backupRoot,
    sanitizeServerName,
    getServerFolder,
    ensureServerFolder,
    getBackupFile
};
