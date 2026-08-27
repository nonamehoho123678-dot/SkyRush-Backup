const {
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");


function backupSelect(){


    const folder =
        path.join(
            __dirname,
            "..",
            "..",
            "backups"
        );


    let backups = [];


    if(fs.existsSync(folder)){


        backups =
            fs.readdirSync(folder)
            .filter(
                f =>
                f.endsWith(".json")
            )
            .map(
                f =>
                f.replace(".json","")
            );


    }




    const menu =
        new StringSelectMenuBuilder()

            .setCustomId(
                "backup_select"
            )

            .setPlaceholder(
                "📦 Chọn Backup"
            )

            .addOptions(

                backups.length

                ?

                backups.slice(0,25)
                .map(id => ({

                    label:id,

                    value:id,

                    description:
                    "Khôi phục backup này"

                }))

                :

                [{

                    label:
                    "Không có backup",

                    value:
                    "none"

                }]

            );



    return new ActionRowBuilder()

        .addComponents(menu);


}



module.exports = backupSelect;