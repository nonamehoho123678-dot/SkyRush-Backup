const { PermissionFlagsBits } = require("discord.js");
const { getAccessibleBackups, hideBackupForUser } = require("../../utils/backup/personalBackups");
const { successEmbed, errorEmbed } = require("../../utils/embed");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được xóa backup.", ephemeral: true });
        }

        const raw = interaction.values[0] || "";
        const split = raw.indexOf(":");
        const guildId = split >= 0 ? raw.slice(0, split) : interaction.guild.id;
        const id = split >= 0 ? raw.slice(split + 1) : raw;

        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        const source = backups.find(item => item.guildId === guildId && item.id === id);

        if (!source) {
            return interaction.update({
                content: `❌ Không tìm thấy backup \`${id}\` trong danh sách của bạn.`,
                embeds: [],
                components: []
            });
        }

        try {
            hideBackupForUser(interaction.user.id, guildId, id);
            return interaction.update({
                content: null,
                embeds: [successEmbed(
                    "🗑️ Đã xóa khỏi danh sách của bạn",
                    `Backup \`${id}\` của server **${source.guildName}** đã được ẩn khỏi tài khoản của bạn.\n\n` +
                    "✅ File backup trong server vẫn còn.\n" +
                    "👥 Admin khác vẫn thấy và dùng được backup này."
                )],
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
