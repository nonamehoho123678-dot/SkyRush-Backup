const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");

const {
    successEmbed,
    errorEmbed,
    infoEmbed
} = require("../../utils/embed");

const createBackup = require("../../utils/backup/createBackup");
const loadBackup = require("../../utils/restore/serverLoadBackup");
const backupSelect = require("../../components/menus/backupSelect");
const {
    getServerFolder,
    getBackupFile,
    sanitizeServerName
} = require("../../utils/backup/storage");

function isAdmin(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    );
}

function createProgressBar(percent) {
    const length = 30;
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.floor((safe / 100) * length);
    return "█".repeat(filled) + "░".repeat(length - filled);
}

function progressText(id, p) {
    const percent = Math.max(0, Math.min(100, Number(p.percent) || 0));
    return [
        `🔄 **Restore: \`${id}\`**`,
        "",
        `\`[${createProgressBar(percent)}] ${percent}%\``,
        "",
        `🎭 Roles: **${p.roles || 0}/${p.totalRoles || 0}**`,
        `📁 Categories: **${p.categories || 0}/${p.totalCategories || 0}**`,
        `💬 Channels: **${p.channels || 0}/${p.totalChannels || 0}**`,
        `😀 Emojis: **${p.emojis || 0}/${p.totalEmojis || 0}**`,
        "",
        "⏳ **Đang khôi phục...**"
    ].join("\n");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup")
        .setDescription("Quản lý backup server")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("create").setDescription("Tạo backup server"))
        .addSubcommand(sub => sub.setName("list").setDescription("Xem danh sách backup"))
        .addSubcommand(sub => sub.setName("info").setDescription("Xem thông tin backup").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("delete").setDescription("Xóa backup").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("load").setDescription("Khôi phục backup").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("panel").setDescription("Mở bảng điều khiển backup")),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "❌ Lệnh này chỉ dùng trong server.", ephemeral: true });
        }

        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: "❌ Chỉ thành viên có quyền **Administrator** mới được sử dụng hệ thống backup.",
                ephemeral: true
            });
        }

        const guild = interaction.guild;
        const sub = interaction.options.getSubcommand();
        const folder = getServerFolder(guild);

        fs.mkdirSync(folder, { recursive: true });

        if (sub === "panel") {
            return interaction.reply({
                content: `⚡ **SkyRush Backup Panel**\n\n🏠 Server: **${guild.name}**\n📦 Backup chỉ thuộc server này:`,
                components: [backupSelect(guild)]
            });
        }

        if (sub === "create") {
            await interaction.deferReply();

            try {
                console.log("");
                console.log("================================");
                console.log("📦 CREATE BACKUP");
                console.log(`🏠 ${guild.name}`);
                console.log("================================");

                const backup = await createBackup(guild);

                console.log("================================");
                console.log(`✅ Backup created: ${backup.id}`);
                console.log(`🎭 Roles: ${backup.roles?.length || 0}`);
                console.log(`💬 Channels: ${backup.channels?.length || 0}`);
                console.log(`😀 Emojis: ${backup.emojis?.length || 0}`);
                console.log(`🏷 Stickers: ${backup.stickers?.length || 0}`);
                console.log("================================");

                return interaction.editReply({
                    embeds: [successEmbed("Backup Created", [
                        `🆔 **ID**\n\`${backup.id}\``,
                        `🏠 **Server**\n${guild.name}`,
                        `📁 **Folder**\n\`${sanitizeServerName(guild.name)}_${guild.id}\``,
                        `🎭 Roles: **${backup.roles?.length || 0}**`,
                        `💬 Channels: **${backup.channels?.length || 0}**`,
                        `😀 Emojis: **${backup.emojis?.length || 0}**`,
                        `🏷 Stickers: **${backup.stickers?.length || 0}**`,
                        `📅 Created: **${backup.createdAt || new Date().toISOString()}**`,
                        "✅ **Backup đã được tạo thành công!**"
                    ].join("\n\n"))],
                    components: []
                });
            }
            catch (error) {
                console.error("❌ CREATE BACKUP ERROR:", error);
                return interaction.editReply({
                    embeds: [errorEmbed("Backup Failed", `❌ Không thể tạo backup.\n\n⚠️ \`${error.message || "Unknown error"}\``)],
                    components: []
                });
            }
        }

        if (sub === "list") {
            try {
                const files = fs.readdirSync(folder)
                    .filter(file => file.endsWith(".json"))
                    .sort((a, b) => b.localeCompare(a));

                return interaction.reply({
                    embeds: [infoEmbed(
                        `📦 Backups - ${guild.name}`,
                        files.length
                            ? files.map(file => `📦 \`${file.replace(/\.json$/, "")}\``).join("\n")
                            : "Server này chưa có backup."
                    )]
                });
            }
            catch (error) {
                return interaction.reply({
                    embeds: [errorEmbed("List Failed", error.message)],
                    ephemeral: true
                });
            }
        }

        if (sub === "info") {
            const id = interaction.options.getString("id", true);
            const file = getBackupFile(guild, id);

            if (!fs.existsSync(file)) {
                return interaction.reply({
                    embeds: [errorEmbed("Không tìm thấy", `Backup \`${id}\` không tồn tại trong server **${guild.name}**.`)],
                    ephemeral: true
                });
            }

            try {
                const backup = JSON.parse(fs.readFileSync(file, "utf8"));
                return interaction.reply({
                    embeds: [infoEmbed("📦 Backup Info", [
                        `🆔 **ID**\n\`${backup.id}\``,
                        `🏠 **Server**\n${backup.guild?.name || guild.name}`,
                        `🎭 Roles: **${backup.roles?.length || 0}**`,
                        `💬 Channels: **${backup.channels?.length || 0}**`,
                        `😀 Emojis: **${backup.emojis?.length || 0}**`,
                        `🏷 Stickers: **${backup.stickers?.length || 0}**`,
                        `📅 Created: **${backup.createdAt || "Unknown"}**`
                    ].join("\n\n"))]
                });
            }
            catch (error) {
                return interaction.reply({
                    embeds: [errorEmbed("Lỗi đọc backup", error.message)],
                    ephemeral: true
                });
            }
        }

        if (sub === "delete") {
            const id = interaction.options.getString("id", true);
            const file = getBackupFile(guild, id);

            if (!fs.existsSync(file)) {
                return interaction.reply({
                    embeds: [errorEmbed("Không tìm thấy", `Backup \`${id}\` không tồn tại trong server này.`)],
                    ephemeral: true
                });
            }

            try {
                fs.unlinkSync(file);
                return interaction.reply({
                    embeds: [successEmbed("Backup Deleted", `🗑️ Đã xóa backup \`${id}\` khỏi server **${guild.name}**.`)]
                });
            }
            catch (error) {
                return interaction.reply({
                    embeds: [errorEmbed("Delete Failed", error.message)],
                    ephemeral: true
                });
            }
        }

        if (sub === "load") {
            await interaction.deferReply();

            const id = interaction.options.getString("id", true);
            const file = getBackupFile(guild, id);

            if (!fs.existsSync(file)) {
                return interaction.editReply({
                    embeds: [errorEmbed("Restore Failed", `❌ Backup \`${id}\` không tồn tại trong server này.`)],
                    components: []
                });
            }

            let lastPercent = -1;
            let lastUpdate = 0;

            const updateProgress = async progress => {
                const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
                const now = Date.now();

                if (percent !== 100 && percent === lastPercent) return;
                if (percent !== 100 && now - lastUpdate < 350) return;

                lastPercent = percent;
                lastUpdate = now;

                try {
                    await interaction.editReply({
                        content: progressText(id, progress),
                        embeds: [],
                        components: []
                    });
                }
                catch (error) {
                    console.log("⚠️ Progress update skip:", error.message);
                }
            };

            try {
                await interaction.editReply({
                    content: progressText(id, {
                        percent: 0,
                        roles: 0,
                        totalRoles: 0,
                        categories: 0,
                        totalCategories: 0,
                        channels: 0,
                        totalChannels: 0,
                        emojis: 0,
                        totalEmojis: 0
                    }),
                    embeds: [],
                    components: []
                });

                const result = await loadBackup(guild, id, updateProgress);

                return interaction.editReply({
                    content: null,
                    embeds: [successEmbed("Restore thành công", [
                        "✅ **Khôi phục backup thành công!**",
                        `🆔 Backup: \`${id}\``,
                        `🏠 Server: **${guild.name}**`,
                        `🎭 Roles: **${result.roles || 0}**`,
                        `📁 Categories: **${result.categories || 0}**`,
                        `💬 Channels: **${result.channels || 0}**`,
                        `😀 Emojis: **${result.emojis || 0}**`,
                        "📊 Tiến trình: **100%**"
                    ].join("\n\n"))],
                    components: []
                });
            }
            catch (error) {
                console.error("❌ RESTORE ERROR:", error);
                return interaction.editReply({
                    content: null,
                    embeds: [errorEmbed("Restore Failed", `❌ Khôi phục backup thất bại.\n\n🆔 \`${id}\`\n\n⚠️ \`${error.message || "Unknown error"}\``)],
                    components: []
                });
            }
        }

        return interaction.reply({ content: "❌ Không xác định được lệnh backup.", ephemeral: true });
    }
};
