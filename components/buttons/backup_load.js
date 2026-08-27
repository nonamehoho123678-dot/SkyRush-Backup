const {
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require("discord.js");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Chỉ Administrator mới được dùng backup.", ephemeral: true });
        }

        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        if (!backups.length) {
            return interaction.reply({
                content: "📦 Bạn chưa có backup nào mà bạn có quyền quản lý.",
                ephemeral: true
            });
        }

        const options = backups.slice(0, 25).map(item => ({
            label: item.id.slice(0, 100),
            value: item.id,
            description: `Nguồn: ${item.guildName}`.slice(0, 100)
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId("backup_load_select")
            .setPlaceholder("🔄 Chọn backup để load")
            .addOptions(options);

        const embed = new EmbedBuilder()
            .setTitle("🔄 Load Backup")
            .setDescription("Chọn backup bên dưới để khôi phục vào **server hiện tại**.")
            .setFooter({ text: "Chỉ hiển thị backup bạn có quyền Administrator" });

        return interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }
};
