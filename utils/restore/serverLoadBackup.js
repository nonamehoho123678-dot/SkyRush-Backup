const fs = require("fs");
const path = require("path");

const loadBackup = require("./loadBackup");
const { getBackupFile } = require("../backup/storage");

let restoring = false;

async function serverLoadBackup(guild, id, onProgress = null) {
    if (!guild?.id) throw new Error("Guild không tồn tại.");

    const source = getBackupFile(guild, id);
    if (!fs.existsSync(source)) {
        throw new Error(`Backup ${id} không tồn tại trong server này.`);
    }

    if (restoring) {
        throw new Error("Đang có một restore khác đang chạy. Vui lòng chờ.");
    }

    restoring = true;

    const legacyRoot = path.join(__dirname, "..", "..", "backups");
    const legacyFile = path.join(legacyRoot, `${id}.json`);
    const tempFile = path.join(legacyRoot, `.restore-${guild.id}-${id}.json`);

    fs.mkdirSync(legacyRoot, { recursive: true });

    let oldData = null;
    let hadOldFile = false;

    try {
        if (fs.existsSync(legacyFile)) {
            hadOldFile = true;
            oldData = fs.readFileSync(legacyFile);
        }

        fs.copyFileSync(source, tempFile);
        fs.renameSync(tempFile, legacyFile);

        return await loadBackup(guild, id, onProgress);
    }
    finally {
        try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

            if (hadOldFile && oldData) {
                fs.writeFileSync(legacyFile, oldData);
            }
            else if (fs.existsSync(legacyFile)) {
                fs.unlinkSync(legacyFile);
            }
        }
        catch (cleanupError) {
            console.log("⚠️ Restore cleanup warning:", cleanupError.message);
        }

        restoring = false;
    }
}

serverLoadBackup.isRunning = () => restoring;

module.exports = serverLoadBackup;
