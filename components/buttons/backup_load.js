const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "❌ Load backup chỉ dùng trong server.", flags: 64 });
        }

        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        if (!backups.length) {
            return interaction.reply({ content: "📦 Bạn chưa có backup nào được phép sử dụng.", flags: 64 });
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
            .setDescription("Chọn backup để khôi phục vào **server hiện tại**.")
            .setFooter({ text: "Hiển thị backup bạn tạo và backup của server bạn là Admin" });

        return interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)],
            flags: 64
        });
    }
};
