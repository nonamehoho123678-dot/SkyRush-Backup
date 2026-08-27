const createBackup = require("../../utils/backup/createBackup");
const { successEmbed, errorEmbed } = require("../../utils/embed");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "❌ Backup chỉ dùng trong server.", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            const backup = await createBackup(interaction.guild, interaction.user.id);
            return interaction.editReply({
                embeds: [successEmbed("📦 Backup Created", [
                    `🆔 **ID**\n\`${backup.id}\``,
                    `🏠 **Server**\n${interaction.guild.name}`,
                    `👤 **Người tạo**\n<@${interaction.user.id}>`,
                    `🎭 Roles: **${backup.roles?.length || 0}**`,
                    `💬 Channels: **${backup.channels?.length || 0}**`,
                    `😀 Emojis: **${backup.emojis?.length || 0}**`,
                    `🏷 Stickers: **${backup.stickers?.length || 0}**`,
                    `📅 Created: **${backup.createdAt || new Date().toISOString()}**`,
                    "✅ **Backup đã được tạo thành công!**"
                ].join("\n\n"))]
            });
        } catch (error) {
            console.error("❌ CREATE BUTTON ERROR:", error);
            return interaction.editReply({ embeds: [errorEmbed("Backup Failed", `❌ ${error.message || "Không thể tạo backup."}`)] });
        }
    }
};
