const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const serverLoadBackup = require("../../utils/restore/serverLoadBackup");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

function bar(percent) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.floor(p / 100 * 25);
    return "█".repeat(filled) + "░".repeat(25 - filled);
}

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được restore.", flags: 64 });
        }

        const prefix = "backup_restore_confirm_";
        const raw = interaction.customId.slice(prefix.length);
        const separator = raw.lastIndexOf("_");
        if (separator <= 0) {
            return interaction.reply({ content: "❌ Dữ liệu restore không hợp lệ.", flags: 64 });
        }

        const id = raw.slice(0, separator);
        const options = raw.slice(separator + 1).split("-").filter(Boolean);
        const allowed = new Set(["name", "icon", "emojis", "stickers"]);
        const selectedOptions = options.filter(v => allowed.has(v));

        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        const source = backups.find(item => item.id === id);
        if (!source || !fs.existsSync(source.filePath)) {
            return interaction.update({ content: `❌ Không tìm thấy backup \`${id}\` hoặc bạn không còn quyền quản lý backup này.`, embeds: [], components: [] });
        }

        await interaction.update({
            content: `🔄 **Đang restore \`${id}\`**\n\n\`[${bar(0)}] 0%\`\n\n⏳ Đang khôi phục...`,
            embeds: [],
            components: []
        });

        let last = -1;
        let lastTime = 0;
        const progress = async p => {
            const percent = Math.max(0, Math.min(100, Number(p.percent) || 0));
            const now = Date.now();
            if (percent !== 100 && (percent === last || now - lastTime < 350)) return;
            last = percent;
            lastTime = now;
            try {
                await interaction.editReply({
                    content: [
                        `🔄 **Đang restore \`${id}\`**`, "",
                        `\`[${bar(percent)}] ${percent}%\``, "",
                        `🎭 Roles: **${p.roles || 0}/${p.totalRoles || 0}**`,
                        `📁 Categories: **${p.categories || 0}/${p.totalCategories || 0}**`,
                        `💬 Channels: **${p.channels || 0}/${p.totalChannels || 0}**`,
                        `😀 Emojis: **${p.emojis || 0}/${p.totalEmojis || 0}**`,
                        `🏷️ Stickers: **${p.stickers || 0}/${p.totalStickers || 0}**`,
                        "", "⏳ **Đang khôi phục...**"
                    ].join("\n"),
                    embeds: [],
                    components: []
                });
            } catch (error) {
                console.log("⚠️ Progress update skip:", error.message);
            }
        };

        try {
            const result = await serverLoadBackup(
                interaction.guild,
                id,
                progress,
                source.filePath,
                {
                    name: selectedOptions.includes("name"),
                    icon: selectedOptions.includes("icon"),
                    emojis: selectedOptions.includes("emojis"),
                    stickers: selectedOptions.includes("stickers")
                }
            );

            const labels = {
                name: "🏠 Tên server",
                icon: "🖼️ Hình đại diện",
                emojis: "😀 Emoji",
                stickers: "🏷️ Sticker"
            };
            const selected = selectedOptions.map(v => labels[v]).filter(Boolean).join(", ") || "Không có";

            return interaction.editReply({
                content: null,
                embeds: [new EmbedBuilder()
                    .setTitle("✅ Restore thành công")
                    .setDescription(
                        `🆔 **Backup:** \`${id}\`\n` +
                        `📤 **Nguồn:** ${source.guildName || "Không rõ"}\n` +
                        `🏠 **Server đích:** ${interaction.guild.name}\n\n` +
                        `🎭 Roles: **${result.roles || 0}**\n` +
                        `📁 Categories: **${result.categories || 0}**\n` +
                        `💬 Channels: **${result.channels || 0}**\n` +
                        `😀 Emojis: **${result.emojis || 0}**\n` +
                        `🏷️ Stickers: **${result.stickers || 0}**\n\n` +
                        `⚙️ **Đã chọn:** ${selected}\n` +
                        "📊 **100% hoàn tất**"
                    )
                    .setTimestamp()]
            });
        } catch (error) {
            console.error("❌ LOAD BACKUP ERROR:", error);
            return interaction.editReply({
                content: `❌ **Restore thất bại**\n\n\`${error.message || "Unknown error"}\``,
                embeds: [],
                components: []
            });
        }
    }
};
