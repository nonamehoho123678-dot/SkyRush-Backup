const cron = require("node-cron");

const db = require("./database");
const createBackup = require("../backup/createBackup");

// Không cho scheduler khởi động nhiều lần trong cùng một process.
// Nếu index.js bị reload hoặc startAutoBackup() bị gọi lại,
// scheduler cũ sẽ không tạo thêm một cron job thứ hai.
let schedulerStarted = false;
let cronTask = null;

function startScheduler(client) {

    if (schedulerStarted) {
        console.log("⚠️ Auto Backup scheduler đã chạy, bỏ qua lần khởi động trùng.");
        return cronTask;
    }

    if (!client) {
        console.error("❌ Auto Backup: client không tồn tại.");
        return null;
    }

    schedulerStarted = true;

    cronTask = cron.schedule(
        "*/1 * * * *",
        async () => {

            db.all(
                "SELECT * FROM settings WHERE enabled = 1",
                async (err, rows) => {

                    if (err) {
                        console.error("❌ Auto Backup database error:", err.message);
                        return;
                    }

                    if (!Array.isArray(rows) || rows.length === 0) {
                        return;
                    }

                    for (const setting of rows) {

                        try {

                            const guild =
                                client.guilds.cache.get(setting.guildId);

                            if (!guild) {
                                continue;
                            }

                            await createBackup(guild);

                            console.log(
                                `✅ Auto backup: ${guild.name}`
                            );

                        }
                        catch (error) {

                            console.error(
                                `❌ Auto backup thất bại cho guild ${setting.guildId}:`,
                                error.message
                            );

                        }
                    }
                }
            );
        }
    );

    console.log("⏰ Auto Backup đã bật");

    return cronTask;
}

module.exports = startScheduler;
