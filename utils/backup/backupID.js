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

function getServerBackupFolder(guild) {
    if (!guild || !guild.id) throw new Error("Guild không tồn tại.");
    return path.join(
        backupRoot,
        `${sanitizeServerName(guild.name)}_${guild.id}`
    );
}

function ensureServerBackupFolder(guild) {
    const folder = getServerBackupFolder(guild);
    fs.mkdirSync(folder, { recursive: true });
    return folder;
}

function getTodayString() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
}

function generateBackupID(guild) {
    const folder = ensureServerBackupFolder(guild);
    const prefix = `${sanitizeServerName(guild.name)}-${getTodayString()}-`;
    let max = 0;

    for (const file of fs.readdirSync(folder)) {
        if (!file.endsWith(".json")) continue;
        const name = file.slice(0, -5);
        if (!name.startsWith(prefix)) continue;
        const n = Number(name.slice(prefix.length));
        if (Number.isInteger(n) && n > max) max = n;
    }

    let n = max + 1;
    let id;
    do {
        id = `${prefix}${String(n).padStart(3, "0")}`;
        n++;
    } while (fs.existsSync(path.join(folder, `${id}.json`)));

    return id;
}

generateBackupID.getServerBackupFolder = getServerBackupFolder;
generateBackupID.ensureServerBackupFolder = ensureServerBackupFolder;
generateBackupID.sanitizeServerName = sanitizeServerName;

module.exports = generateBackupID;
