const fs = require("fs");
const path = require("path");

function saveBackup(id, data) {

    const folder = path.join(
        __dirname,
        "..",
        "..",
        "backups"
    );

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }

    const file = path.join(
        folder,
        `${id}.json`
    );

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 4)
    );

    return file;

}

module.exports = saveBackup;