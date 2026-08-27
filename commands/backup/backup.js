const {
    SlashCommandBuilder,
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
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "❌ /backup cần được sử dụng trong server.", flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle("⚡ SkyRush Backup")
            .setDescription(
                `🏠 **${interaction.guild.name}**\n\n` +
                "📦 **Create Backup**\nTạo backup cho server này.\n\n" +
                "🔄 **Load Backup**\nChọn backup mà bạn được phép sử dụng.\n\n" +
                "🗑️ **Delete Backup**\nẨn backup khỏi danh sách của bạn.\n\n" +
                "👇 **Chọn chức năng bên dưới**"
            )
            .setFooter({ text: "SkyRush Backup • Backup cá nhân + quyền Admin server" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("backup_create").setLabel("Create Backup").setEmoji("📦").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("backup_load").setLabel("Load Backup").setEmoji("🔄").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("backup_delete").setLabel("Delete Backup").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }
};
