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

        const backups = (await getAccessibleBackups(interaction.client, interaction.user.id))
            .filter(item => item.guildId === interaction.guild.id);

        if (!backups.length) {
            return interaction.reply({
                content: "🗑️ Server này chưa có backup để xóa.",
                ephemeral: true
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("backup_delete_select")
            .setPlaceholder("🗑️ Chọn backup để xóa")
            .addOptions(backups.slice(0, 25).map(item => ({
                label: item.id.slice(0, 100),
                value: item.id,
                description: `Tạo lúc: ${item.createdAt || "Không rõ"}`.slice(0, 100)
            })));

        const embed = new EmbedBuilder()
            .setTitle("🗑️ Delete Backup")
            .setDescription("Chọn backup của **server hiện tại** để xóa.")
            .setFooter({ text: "Xóa backup là không thể hoàn tác" });

        return interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }
};
