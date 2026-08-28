const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const fs = require("fs");

function build(backupId) {
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
                "Chọn thêm các phần muốn khôi phục bên dưới.\n\n" +
                "💡 Có thể chọn nhiều mục cùng lúc.\n" +
                "⚠️ Sau khi chọn, hãy bấm **Xác nhận Restore** để bắt đầu."
            )
            .setFooter({ text: "SkyRush Backup" })],
        components: [new ActionRowBuilder().addComponents(menu)]
    };
}

function buildConfirmation(backupId, options) {
    const labels = {
        name: "🏠 Tên server",
        icon: "🖼️ Hình đại diện",
        emojis: "😀 Emoji",
        stickers: "🏷️ Sticker"
    };
    const selected = options.map(v => labels[v]).filter(Boolean).join(", ") || "Không có";

    const confirmButton = new ButtonBuilder()
        .setCustomId(`backup_restore_confirm_${backupId}_${options.join("-")}`)
        .setLabel("Xác nhận Restore")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`backup_restore_cancel_${backupId}`)
        .setLabel("Hủy")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger);

    return {
        embeds: [new EmbedBuilder()
            .setTitle("⚠️ Xác nhận Restore")
            .setDescription(
                `🆔 **Backup:** \`${backupId}\`\n\n` +
                `📦 **Dữ liệu đã chọn:**\n${selected}\n\n` +
                "🎭 Role + Channel sẽ **luôn** được khôi phục.\n\n" +
                "Bạn có chắc muốn bắt đầu restore không?"
            )
            .setFooter({ text: "SkyRush Backup • Kiểm tra kỹ trước khi xác nhận" })],
        components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)]
    };
}

module.exports = {
    build,
    buildConfirmation,

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "❌ Restore chỉ dùng trong server.", flags: 64 });
        }

        const id = interaction.customId.replace("backup_restore_options_", "");
        const options = interaction.values || [];

        // Chỉ hiển thị màn hình xác nhận, CHƯA restore.
        return interaction.update(buildConfirmation(id, options));
    }
};
