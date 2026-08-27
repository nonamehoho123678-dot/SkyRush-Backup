const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");


function restoreConfirm(id) {

    return new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `restore_yes_${id}`
                )

                .setLabel("✅ Xác nhận")

                .setStyle(
                    ButtonStyle.Success
                ),


            new ButtonBuilder()

                .setCustomId(
                    "restore_no"
                )

                .setLabel("❌ Hủy")

                .setStyle(
                    ButtonStyle.Danger
                )

        );

}


module.exports = restoreConfirm;