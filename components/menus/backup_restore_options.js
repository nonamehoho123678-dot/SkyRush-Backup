const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const LABELS = {
    name: "🏠 Tên server",
    icon: "🖼️ Hình đại diện",
    emojis: "😀 Emoji",
    stickers: "🏷️ Sticker"
};

const ALLOWED = new Set(Object.keys(LABELS));

function build(backupId, selectedOptions = []) {
    const selected = selectedOptions.filter(value => ALLOWED.has(value));
    const selectedText = selected.length
        ? selected.map(value => LABELS[value]).join(", ")
        : "Chưa chọn";

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`backup_restore_options_${backupId}`)
        .setPlaceholder("⚙️ Chọn dữ liệu muốn khôi phục")
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions(
            {
                label: "Tên server",
                value: "name",
                emoji: "🏠",
                description: "Khôi phục tên server",
                default: selected.includes("name")
            },
            {
                label: "Hình đại diện",
                value: "icon",
                emoji: "🖼️",
                description: "Khôi phục avatar server",
                default: selected.includes("icon")
            },
            {
                label: "Emoji",
                value: "emojis",
                emoji: "😀",
                description: "Khôi phục emoji",
                default: selected.includes("emojis")
            },
            {
                label: "Sticker",
                value: "stickers",
                emoji: "🏷️",
                description: "Khôi phục sticker",
                default: selected.includes("stickers")
            }
        );

    const confirmButton = new ButtonBuilder()
        .setCustomId(
            `backup_restore_confirm_${backupId}_${selected.join("-") || "none"}`
        )
        .setLabel("Xác nhận Restore")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(selected.length === 0);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`backup_restore_cancel_${backupId}`)
        .setLabel("Hủy")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger);

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle("⚙️ Restore Backup")
                .setDescription(
                    `🆔 **Backup:** \`${backupId}\`\n\n` +
                    "🎭 **Role + Channel** luôn được khôi phục.\n\n" +
                    `📦 **Dữ liệu thêm:** ${selectedText}\n\n` +
                    "👇 Chọn dữ liệu muốn khôi phục rồi bấm **Xác nhận Restore** ngay bên dưới."
                )
                .setFooter({ text: "SkyRush Backup • Chọn và xác nhận trong cùng một giao diện" })
        ],
        components: [
            new ActionRowBuilder().addComponents(menu),
            new ActionRowBuilder().addComponents(confirmButton, cancelButton)
        ]
    };
}

module.exports = {
    build,

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Restore chỉ dùng trong server.",
                flags: 64
            });
        }

        const id = interaction.customId.replace("backup_restore_options_", "");
        const options = interaction.values || [];

        // Không chuyển sang một màn hình xác nhận khác.
        // Menu chọn dữ liệu và nút xác nhận nằm cùng một giao diện.
        return interaction.update(build(id, options));
    }
};
