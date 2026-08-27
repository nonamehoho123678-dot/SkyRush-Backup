const {
    EmbedBuilder
} = require("discord.js");


const backupButtons =
require("../buttons/backupButtons");



function backupPanel(){


    const embed = new EmbedBuilder()

        .setColor("#5865F2")

        .setTitle("⚡ SkyRush Backup Panel")

        .setDescription(

`
📦 **Backup System**

Tạo và quản lý bản sao server.


🔄 **Restore**

Khôi phục server nhanh.


⚙️ **Management**

Quản lý dữ liệu backup.


Chọn chức năng bên dưới 👇
`

        )

        .setFooter({

            text:
            "SkyRush Backup"

        })

        .setTimestamp();



    return {

        embeds:[embed],

        components:[

            backupButtons()

        ]

    };


}


module.exports = backupPanel;