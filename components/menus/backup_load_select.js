const {
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const loadBackup = require("../../utils/restore/serverLoadBackup");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");
const restoreOptions = require("./backup_restore_options");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được restore.", flags: 64 });
        }

        const id = interaction.values[0];
        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        const source = backups.find(item => item.id === id);

        if (!source || !fs.existsSync(source.filePath)) {
            return interaction.update({
                content: `❌ Không tìm thấy backup \`${id}\` hoặc bạn không còn quyền quản lý backup này.`,
                embeds: [],
                components: []
            });
        }

        // Trả lời interaction ngay để không bị Unknown interaction nếu người
        // dùng chọn menu sau vài giây.
        await interaction.update({
            content: null,
            ...restoreOptions.build(id)
        });
    }
};
