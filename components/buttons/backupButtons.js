const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");


function backupButtons(){


    return new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId("backup_create")

                .setLabel("📦 Create Backup")

                .setStyle(
                    ButtonStyle.Success
                ),


            new ButtonBuilder()

                .setCustomId("backup_list")

                .setLabel("📋 List Backup")

                .setStyle(
                    ButtonStyle.Primary
                ),


            new ButtonBuilder()

                .setCustomId("backup_load")

                .setLabel("🔄 Restore")

                .setStyle(
                    ButtonStyle.Secondary
                )

        );


}


module.exports = backupButtons;