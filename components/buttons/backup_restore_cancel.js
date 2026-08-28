const { EmbedBuilder } = require("discord.js");

module.exports = {
    async execute(interaction) {
        return interaction.update({
            content: null,
            embeds: [new EmbedBuilder()
                .setTitle("❌ Đã hủy Restore")
                .setDescription("Không có thay đổi nào được thực hiện.")
                .setFooter({ text: "SkyRush Backup" })
                .setTimestamp()],
            components: []
        });
    }
};
