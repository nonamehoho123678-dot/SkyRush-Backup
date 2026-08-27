const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup")
        .setDescription("Mở bảng điều khiển SkyRush Backup")
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ /backup cần được sử dụng trong server.",
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Chỉ Administrator mới được sử dụng SkyRush Backup.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("⚡ SkyRush Backup")
            .setDescription(
                `🏠 **${interaction.guild.name}**\n\n` +
                "📦 **Create Backup**\nTạo một bản backup mới của server.\n\n" +
                "🔄 **Load Backup**\nChọn backup để khôi phục server.\n\n" +
                "🗑️ **Delete Backup**\nChọn backup để xóa.\n\n" +
                "👇 **Chọn chức năng bên dưới**"
            )
            .setFooter({ text: "SkyRush Backup • Administrator" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("backup_create")
                .setLabel("Create Backup")
                .setEmoji("📦")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("backup_load")
                .setLabel("Load Backup")
                .setEmoji("🔄")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("backup_delete")
                .setLabel("Delete Backup")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};
