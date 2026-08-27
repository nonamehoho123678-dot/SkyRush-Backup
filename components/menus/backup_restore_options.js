const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const serverLoadBackup = require("../../utils/restore/serverLoadBackup");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

function bar(percent) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.floor(p / 100 * 25);
    return "█".repeat(filled) + "░".repeat(25 - filled);
}

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
            .setDescription(`🆔 Backup: \`${backupId}\`\n\n🎭 **Role + Channel** luôn được khôi phục.\nChọn thêm các phần muốn khôi phục bên dưới.\n\n💡 Có thể chọn nhiều mục cùng lúc.`)
            .setFooter({ text: "SkyRush Backup" })],
        components: [new ActionRowBuilder().addComponents(menu)]
    };
}

module.exports = {
    build,

    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được restore.", flags: 64 });
        }

        const id = interaction.customId.replace("backup_restore_options_", "");
        const options = interaction.values || [];
        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        const source = backups.find(item => item.id === id);

        if (!source || !fs.existsSync(source.filePath)) {
            return interaction.update({ content: `❌ Không tìm thấy backup \`${id}\`.`, embeds: [], components: [] });
        }

        await interaction.update({ content: `🔄 **Đang restore \`${id}\`**\n\n\`[${bar(0)}] 0%\`\n\n⏳ Đang khôi phục...`, embeds: [], components: [] });

        let last = -1;
        let lastTime = 0;
        const progress = async p => {
            const percent = Math.max(0, Math.min(100, Number(p.percent) || 0));
            const now = Date.now();
            if (percent !== 100 && (percent === last || now - lastTime < 350)) return;
            last = percent;
            lastTime = now;
            try {
                await interaction.editReply({ content: [
                    `🔄 **Đang restore \`${id}\`**`, "", `\`[${bar(percent)}] ${percent}%\``, "",
                    `🎭 Roles: **${p.roles || 0}/${p.totalRoles || 0}**`,
                    `📁 Categories: **${p.categories || 0}/${p.totalCategories || 0}**`,
                    `💬 Channels: **${p.channels || 0}/${p.totalChannels || 0}**`,
                    `😀 Emojis: **${p.emojis || 0}/${p.totalEmojis || 0}**`, "", "⏳ **Đang khôi phục...**"
                ].join("\n"), embeds: [], components: [] });
            } catch (error) { console.log("⚠️ Progress update skip:", error.message); }
        };

        try {
            const result = await serverLoadBackup(interaction.guild, id, progress, source.filePath, {
                name: options.includes("name"),
                icon: options.includes("icon"),
                emojis: options.includes("emojis"),
                stickers: options.includes("stickers")
            });

            const labels = { name: "🏠 Tên", icon: "🖼️ Avatar", emojis: "😀 Emoji", stickers: "🏷️ Sticker" };
            const selected = options.map(v => labels[v]).filter(Boolean).join(", ") || "Không có";
            return interaction.editReply({
                content: null,
                embeds: [new EmbedBuilder()
                    .setTitle("✅ Restore thành công")
                    .setDescription(
                        `🆔 **Backup:** \`${id}\`\n📤 **Nguồn:** ${source.guildName}\n🏠 **Server đích:** ${interaction.guild.name}\n\n` +
                        `🎭 Roles: **${result.roles || 0}**\n📁 Categories: **${result.categories || 0}**\n💬 Channels: **${result.channels || 0}**\n😀 Emojis: **${result.emojis || 0}**\n🏷️ Stickers: **${result.stickers || 0}**\n\n` +
                        `⚙️ **Đã chọn:** ${selected}\n📊 **100% hoàn tất**`
                    )
                    .setTimestamp()]
            });
        } catch (error) {
            console.error("❌ LOAD BACKUP ERROR:", error);
            return interaction.editReply({ content: `❌ **Restore thất bại**\n\n\`${error.message || "Unknown error"}\``, embeds: [], components: [] });
        }
    }
};
