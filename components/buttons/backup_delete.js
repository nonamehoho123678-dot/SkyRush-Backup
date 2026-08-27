const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { getAccessibleBackups } = require("../../utils/backup/personalBackups");

module.exports = {
    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: "❌ Delete backup chỉ dùng trong server.", flags: 64 });

        const backups = await getAccessibleBackups(interaction.client, interaction.user.id);
        if (!backups.length) return interaction.reply({ content: "📦 Không có backup nào mà bạn có quyền quản lý.", flags: 64 });

        const options = backups.slice(0, 25).map(item => ({
            label: item.id.slice(0, 100),
            value: `${item.guildId}:${item.id}`.slice(0, 100),
            description: `Server: ${item.guildName}`.slice(0, 100)
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId("backup_delete_select")
            .setPlaceholder("🗑️ Chọn backup muốn ẩn khỏi danh sách của bạn")
            .addOptions(options);

        const embed = new EmbedBuilder()
            .setTitle("🗑️ Delete Backup")
            .setDescription("Chọn backup muốn **xóa khỏi danh sách cá nhân**.\n\n⚠️ File backup trong server **không bị xóa**.\n👥 Admin của server vẫn nhìn thấy và sử dụng được backup đó.")
            .setFooter({ text: "Xóa ở đây chỉ ẩn backup đối với tài khoản của bạn" });

        return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
    }
};
