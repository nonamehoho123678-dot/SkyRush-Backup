const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    async execute(interaction) {
        const values = interaction.values || [];
        const id = interaction.customId.replace("backup_restore_options_", "");

        // Menu này được tạo động theo backup id; interactionCreate sẽ không
        // tìm được file nếu customId chứa id. File này chỉ là fallback.
        return interaction.reply({
            content: "❌ Menu restore không hợp lệ.",
            flags: 64
        });
    },

    build(backupId) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`backup_restore_options_${backupId}`)
            .setPlaceholder("⚙️ Chọn dữ liệu muốn khôi phục")
            .setMinValues(1)
            .setMaxValues(4)
            .addOptions(
                { label: "Tên server", value: "name", emoji: "🏠", description: "Khôi phục tên server" },
                { label: "Hình đại diện", value: "icon", emoji: "🖼️", description: "Khôi phục avatar server" },
                { label: "Emoji", value: "emojis", emoji: "😀", description: "Khôi phục emoji" },
                { label: "Sticker", value: "stickers", emoji: "🏷️", description: "Khôi phục sticker" }
            );

        return {
            embeds: [new EmbedBuilder()
                .setTitle("⚙️ Tùy chọn Restore")
                .setDescription(
                    `🆔 Backup: \`${backupId}\`\n\n` +
                    "🎭 **Role + Channel** luôn được khôi phục.\n" +
                    "Bên dưới hãy chọn thêm những phần của server mà bạn muốn khôi phục.\n\n" +
                    "💡 Có thể chọn nhiều mục cùng lúc."
                )
                .setFooter({ text: "SkyRush Backup" })],
            components: [new ActionRowBuilder().addComponents(menu)]
        };
    }
};
