const { PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");
const { errorEmbed, successEmbed } = require("../../utils/embed");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được xóa backup.", ephemeral: true });
        }

        const id = interaction.values[0];
        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        const source = backups.find(item => item.id === id && item.guildId === interaction.guild.id);

        if (!source || !fs.existsSync(source.filePath)) {
            return interaction.update({
                content: `❌ Backup \`${id}\` không tồn tại trong server này.`,
                embeds: [],
                components: []
            });
        }

        try {
            fs.unlinkSync(source.filePath);
            return interaction.update({
                content: null,
                embeds: [successEmbed("🗑️ Backup Deleted", `Đã xóa backup \`${id}\` khỏi server **${interaction.guild.name}**.`)],
                components: []
            });
        } catch (error) {
            return interaction.update({
                content: null,
                embeds: [errorEmbed("Delete Failed", error.message)],
                components: []
            });
        }
    }
};
