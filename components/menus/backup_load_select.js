const {
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const loadBackup = require("../../utils/restore/serverLoadBackup");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

function bar(percent) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.floor(p / 100 * 25);
    return "█".repeat(filled) + "░".repeat(25 - filled);
}

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được restore.", ephemeral: true });
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

        await interaction.update({
            content: `🔄 **Đang load \`${id}\`**\n\n\`[${bar(0)}] 0%\`\n\n⏳ Đang khôi phục...`,
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
                        `🔄 **Đang load \`${id}\`**`,
                        "",
                        `\`[${bar(percent)}] ${percent}%\``,
                        "",
                        `🎭 Roles: **${p.roles || 0}/${p.totalRoles || 0}**`,
                        `📁 Categories: **${p.categories || 0}/${p.totalCategories || 0}**`,
                        `💬 Channels: **${p.channels || 0}/${p.totalChannels || 0}**`,
                        `😀 Emojis: **${p.emojis || 0}/${p.totalEmojis || 0}**`,
                        "",
                        "⏳ **Đang khôi phục...**"
                    ].join("\n"),
                    embeds: [],
                    components: []
                });
            } catch (error) {
                console.log("⚠️ Progress update skip:", error.message);
            }
        };

        try {
            const result = await loadBackup(
                interaction.guild,
                id,
                progress,
                source.filePath
            );

            const embed = new EmbedBuilder()
                .setTitle("✅ Restore thành công")
                .setDescription(
                    `🆔 **Backup:** \`${id}\`\n` +
                    `📤 **Nguồn:** ${source.guildName}\n` +
                    `🏠 **Đích:** ${interaction.guild.name}\n\n` +
                    `🎭 Roles: **${result.roles || 0}**\n` +
                    `📁 Categories: **${result.categories || 0}**\n` +
                    `💬 Channels: **${result.channels || 0}**\n` +
                    `😀 Emojis: **${result.emojis || 0}**\n\n` +
                    "📊 **100% hoàn tất**"
                )
                .setTimestamp();

            return interaction.editReply({ content: null, embeds: [embed], components: [] });
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
