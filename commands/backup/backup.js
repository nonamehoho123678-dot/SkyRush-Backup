const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ApplicationIntegrationType,
    InteractionContextType
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
const {
    getAccessibleBackups,
    findAccessibleBackup
} = require("../../utils/backup/personalBackups");

function isGuildAdmin(interaction) {
    return Boolean(
        interaction.guild &&
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
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName("create").setDescription("Tạo backup server"))
        .addSubcommand(sub => sub.setName("list").setDescription("Xem backup của server hiện tại"))
        .addSubcommand(sub => sub.setName("mine").setDescription("Xem backup bạn có quyền quản lý ở các server"))
        .addSubcommand(sub => sub.setName("info").setDescription("Xem thông tin backup").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("delete").setDescription("Xóa backup").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("load").setDescription("Khôi phục backup vào server hiện tại").addStringOption(option => option.setName("id").setDescription("Backup ID").setRequired(true)))
        .addSubcommand(sub => sub.setName("panel").setDescription("Mở bảng điều khiển backup")),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // =====================================================
        // 👤 PERSONAL BACKUP LIST
        // Chạy được khi app được cài vào tài khoản người dùng.
        // Không cần guild hiện tại.
        // =====================================================
        if (sub === "mine") {
            try {
                const backups = await getAccessibleBackups(interaction.client, interaction.user.id);

                if (!backups.length) {
                    return interaction.reply({
                        embeds: [infoEmbed(
                            "📦 Backup của bạn",
                            "Chưa tìm thấy backup nào trong các server mà bạn đang có quyền **Administrator** và bot đang tham gia."
                        )],
                        ephemeral: true
                    });
                }

                const shown = backups.slice(0, 20);
                const lines = shown.map(item =>
                    `📦 \`${item.id}\` — 🏠 **${item.guildName}**\n└ 📅 ${item.createdAt || "Không rõ"}`
                );

                if (backups.length > shown.length) {
                    lines.push(`\n… và **${backups.length - shown.length}** backup khác.`);
                }

                return interaction.reply({
                    embeds: [infoEmbed(
                        "📦 Backup của bạn",
                        "Các backup bạn có thể quản lý vì bạn là Administrator trong server nguồn:\n\n" + lines.join("\n\n") +
                        "\n\n💡 Muốn dùng backup cho server khác: vào server đích và dùng **/backup load id:<ID>**."
                    )],
                    ephemeral: true
                });
            }
            catch (error) {
                console.error("❌ PERSONAL BACKUP LIST ERROR:", error);
                return interaction.reply({
                    embeds: [errorEmbed("Personal Backup Failed", error.message)],
                    ephemeral: true
                });
            }
        }

        // Các thao tác backup/restore thật sự phải chạy trong server
        // và người dùng phải có Administrator.
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Lệnh này cần được chạy trong một server. Trong DM bạn chỉ có thể dùng **/backup mine** để xem backup của mình.",
                ephemeral: true
            });
        }

        if (!isGuildAdmin(interaction)) {
            return interaction.reply({
                content: "❌ Chỉ thành viên có quyền **Administrator** mới được sử dụng hệ thống backup.",
                ephemeral: true
            });
        }

        const guild = interaction.guild;
        const folder = getServerFolder(guild);
        fs.mkdirSync(folder, { recursive: true });

        // =====================================================
        // 🎛️ PANEL
        // =====================================================
        if (sub === "panel") {
            return interaction.reply({
                content: `⚡ **SkyRush Backup Panel**\n\n🏠 Server: **${guild.name}**\n📦 Backup thuộc server này:`,
                components: [backupSelect(guild)]
            });
        }

        // =====================================================
        // 📦 CREATE
        // =====================================================
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

        // =====================================================
        // 📋 LIST - chỉ backup server hiện tại
        // =====================================================
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

        // =====================================================
        // ℹ️ INFO
        // =====================================================
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

        // =====================================================
        // 🗑️ DELETE
        // =====================================================
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

        // =====================================================
        // 🔄 LOAD
        // Nếu ID không có trong server đích, tìm trong các server
        // mà người dùng đang là Administrator.
        // =====================================================
        if (sub === "load") {
            await interaction.deferReply();

            const id = interaction.options.getString("id", true);
            const localFile = getBackupFile(guild, id);
            let sourceFile = localFile;
            let sourceInfo = null;

            if (!fs.existsSync(localFile)) {
                sourceInfo = await findAccessibleBackup(
                    interaction.client,
                    interaction.user.id,
                    id
                );

                if (!sourceInfo) {
                    return interaction.editReply({
                        embeds: [errorEmbed(
                            "Restore Failed",
                            `❌ Backup \`${id}\` không tồn tại trong server hiện tại và bạn không có quyền quản lý backup này ở server khác.`
                        )],
                        components: []
                    });
                }

                sourceFile = sourceInfo.filePath;
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

                const result = await loadBackup(
                    guild,
                    id,
                    updateProgress,
                    sourceFile
                );

                const sourceText = sourceInfo
                    ? `\n\n📤 **Nguồn backup:** ${sourceInfo.guildName}`
                    : "";

                return interaction.editReply({
                    content: null,
                    embeds: [successEmbed("Restore thành công", [
                        "✅ **Khôi phục backup thành công!**",
                        `🆔 Backup: \`${id}\``,
                        `🏠 Server đích: **${guild.name}**`,
                        sourceText.trim(),
                        `🎭 Roles: **${result.roles || 0}**`,
                        `📁 Categories: **${result.categories || 0}**`,
                        `💬 Channels: **${result.channels || 0}**`,
                        `😀 Emojis: **${result.emojis || 0}**`,
                        "📊 Tiến trình: **100%**"
                    ].filter(Boolean).join("\n\n"))],
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

        return interaction.reply({
            content: "❌ Không xác định được lệnh backup.",
            ephemeral: true
        });
    }
};
