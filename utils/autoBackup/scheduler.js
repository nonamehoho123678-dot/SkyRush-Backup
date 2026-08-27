const cron = require("node-cron");

const db = require("./database");

const createBackup =
require("../backup/createBackup");



function startScheduler(client) {


    cron.schedule(

        "*/1 * * * *",

        async () => {


            db.all(

                "SELECT * FROM settings WHERE enabled = 1",

                async (err, rows) => {


                    if (err) return;



                    for (const setting of rows) {


                        const guild =
                            client.guilds.cache.get(
                                setting.guildId
                            );


                        if (!guild)
                            continue;



                        await createBackup(
                            guild
                        );


                        console.log(

                            `✅ Auto backup: ${guild.name}`

                        );


                    }


                }

            );


        }

    );


    console.log(
        "⏰ Auto Backup đã bật"
    );

}


module.exports = startScheduler;