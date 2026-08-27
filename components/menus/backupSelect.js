const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const { getServerFolder } = require("../../utils/backup/storage");

function backupSelect(guild) {
    const folder = getServerFolder(guild);
    fs.mkdirSync(folder, { recursive: true });

    const backups = fs.readdirSync(folder)
        .filter(file => file.endsWith(".json"))
        .map(file => file.replace(/\.json$/, ""))
        .sort((a, b) => b.localeCompare(a));

    const menu = new StringSelectMenuBuilder()
        .setCustomId("backup_select")
        .setPlaceholder("📦 Chọn Backup")
        .addOptions(
            backups.length
                ? backups.slice(0, 25).map(id => ({
                    label: id.slice(0, 100),
                    value: id,
                    description: "Khôi phục backup của server này"
                }))
                : [{
                    label: "Không có backup",
                    value: "none",
                    description: "Server chưa có backup"
                }]
        );

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = backupSelect;
