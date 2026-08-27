const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Hiển thị danh sách lệnh của SkyRush Backup"),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("📚 SkyRush Backup")
            .setDescription("Danh sách các lệnh hiện có.")
            .addFields(
                {
                    name: "🛠 Utility",
                    value:
                        "`/ping` - Kiểm tra độ trễ\n" +
                        "`/help` - Danh sách lệnh"
                },
                {
                    name: "💾 Backup",
                    value:
                        "`/backup-create`\n" +
                        "`/backup-load`\n" +
                        "`/backup-list`\n" +
                        "`/backup-delete`\n" +
                        "*Đang phát triển*"
                }
            )
            .setFooter({
                text: "SkyRush Backup v3"
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });

    }

};