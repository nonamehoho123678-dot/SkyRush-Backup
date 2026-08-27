const fs = require("fs");
const { getBackupFile, ensureServerFolder } = require("./storage");

function saveBackup(guild, id, data) {
    if (!guild?.id) throw new Error("Guild không tồn tại.");

    ensureServerFolder(guild);

    const file = getBackupFile(guild, id);

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 4),
        "utf8"
    );

    return file;
}

module.exports = saveBackup;
