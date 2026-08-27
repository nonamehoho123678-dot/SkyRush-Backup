const { PermissionFlagsBits } = require("discord.js");
const createBackup = require("../../utils/backup/createBackup");
const { successEmbed, errorEmbed } = require("../../utils/embed");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được dùng backup.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const backup = await createBackup(interaction.guild);
            return interaction.editReply({
                embeds: [successEmbed("📦 Backup Created", [
                    `🆔 **ID**\n\`${backup.id}\``,
                    `🏠 **Server**\n${interaction.guild.name}`,
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
            return interaction.editReply({
                embeds: [errorEmbed("Backup Failed", `❌ ${error.message || "Không thể tạo backup."}`)]
            });
        }
    }
};
