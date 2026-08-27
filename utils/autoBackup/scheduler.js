const cron = require("node-cron");

const db = require("./database");
const createBackup = require("../backup/createBackup");

// Không cho scheduler khởi động nhiều lần trong cùng một process.
let schedulerStarted = false;
let cronTask = null;

function startScheduler(client) {

    if (schedulerStarted) {
        console.log(
            "⚠️ Auto Backup scheduler đã chạy, bỏ qua lần khởi động trùng."
        );
        return cronTask;
    }

    if (!client) {
        console.error(
            "❌ Auto Backup: client không tồn tại."
        );
        return null;
    }

    schedulerStarted = true;

    cronTask = cron.schedule(
        "*/1 * * * *",
        async () => {

            // Nếu /backup create hoặc một auto backup khác đang chạy,
            // không tạo thêm backup thứ hai.
            if (createBackup.isRunning()) {
                console.log(
                    "⏭️ Bỏ qua Auto Backup: đang có backup khác chạy."
                );
                return;
            }

            db.all(
                "SELECT * FROM settings WHERE enabled = 1",
                async (err, rows) => {

                    if (err) {
                        console.error(
                            "❌ Auto Backup database error:",
                            err.message
                        );
                        return;
                    }

                    if (!Array.isArray(rows) || rows.length === 0) {
                        return;
                    }

                    for (const setting of rows) {

                        try {

                            // Kiểm tra lại trước từng guild vì backup trước
                            // có thể vẫn đang chạy.
                            if (createBackup.isRunning()) {
                                console.log(
                                    "⏭️ Bỏ qua Auto Backup còn lại: đang có backup chạy."
                                );
                                break;
                            }

                            const guild =
                                client.guilds.cache.get(
                                    setting.guildId
                                );

                            if (!guild) {
                                continue;
                            }

                            await createBackup(guild);

                            console.log(
                                `✅ Auto backup: ${guild.name}`
                            );

                        }
                        catch (error) {

                            // Nếu một backup khác vừa chiếm lock thì không xem
                            // đó là lỗi nghiêm trọng.
                            if (
                                error.message &&
                                error.message.includes(
                                    "Đang có một backup khác đang chạy"
                                )
                            ) {
                                console.log(
                                    "⏭️ Auto Backup bị bỏ qua: backup khác đang chạy."
                                );
                                break;
                            }

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

    console.log(
        "⏰ Auto Backup đã bật"
    );

    return cronTask;
}

module.exports = startScheduler;
