const fs = require("fs");
const path = require("path");
const loadBackup = require("./loadBackup");
const applyPermissions = require("./applyPermissions");
const { getBackupFile } = require("../backup/storage");

let restoring = false;

async function serverLoadBackup(guild, id, onProgress = null, sourceFile = null, options = {}) {
    if (!guild?.id) throw new Error("Guild không tồn tại.");

    const source = sourceFile || getBackupFile(guild, id);
    if (!fs.existsSync(source)) throw new Error(`Backup ${id} không tồn tại.`);
    if (restoring) throw new Error("Đang có một restore khác đang chạy. Vui lòng chờ.");

    restoring = true;
    const legacyRoot = path.join(__dirname, "..", "..", "backups");
    const legacyFile = path.join(legacyRoot, `${id}.json`);
    const tempFile = path.join(legacyRoot, `.restore-${guild.id}-${id}.json`);
    fs.mkdirSync(legacyRoot, { recursive: true });

    let oldData = null;
    let hadOldFile = false;

    try {
        const backup = JSON.parse(fs.readFileSync(source, "utf8"));

        if (fs.existsSync(legacyFile)) {
            hadOldFile = true;
            oldData = fs.readFileSync(legacyFile);
        }

        fs.copyFileSync(source, tempFile);
        fs.renameSync(tempFile, legacyFile);

        const result = await loadBackup(guild, id, onProgress);

        // QUAN TRỌNG: loadBackup có bước permission cũ, nhưng ở một số
        // trường hợp role/channel vừa được tạo hoặc vừa được map xong thì
        // overwrite có thể chưa áp dụng đúng. Chạy thêm một bước SET cuối
        // cùng sau khi toàn bộ cấu trúc đã tồn tại.
        try {
            const permissionResult = await applyPermissions(guild, backup);
            console.log(
                `🔐 Final permissions: ${permissionResult.channels} channels, ${permissionResult.overwrites} overwrites`
            );
        } catch (error) {
            console.log(`⚠️ Final permission restore skip: ${error.message}`);
        }

        let emojiCount = 0;
        let stickerCount = 0;

        // Tên + avatar chỉ được đổi khi người dùng chọn.
        if (options.name || options.icon) {
            const edit = {};
            if (options.name && backup.guild?.name) edit.name = backup.guild.name;
            if (options.icon) edit.icon = backup.guild?.icon || null;
            try {
                if (Object.keys(edit).length) await guild.edit(edit);
                console.log("🏠 Restore server settings OK");
            } catch (error) {
                console.log("⚠️ Không thể restore tên/avatar:", error.message);
            }
        }

        // Emoji: tạo nếu chưa có emoji cùng tên. Không xóa emoji hiện tại.
        if (options.emojis && Array.isArray(backup.emojis)) {
            for (const emoji of backup.emojis) {
                try {
                    const exists = guild.emojis.cache.find(e => e.name === emoji.name);
                    if (exists) continue;
                    if (!emoji.url || !emoji.name) continue;
                    const created = await guild.emojis.create({
                        attachment: emoji.url,
                        name: emoji.name,
                        reason: `SkyRush Backup restore ${id}`
                    });
                    if (created) emojiCount++;
                } catch (error) {
                    console.log(`⚠️ Không thể restore emoji ${emoji.name}:`, error.message);
                }
            }
        }

        // Sticker: tạo nếu chưa có sticker cùng tên. Không xóa sticker hiện tại.
        if (options.stickers && Array.isArray(backup.stickers)) {
            for (const sticker of backup.stickers) {
                try {
                    const exists = guild.stickers.cache.find(s => s.name === sticker.name);
                    if (exists) continue;
                    if (!sticker.url || !sticker.name || !sticker.tags) continue;
                    const created = await guild.stickers.create({
                        file: sticker.url,
                        name: sticker.name,
                        description: sticker.description || "SkyRush Backup sticker",
                        tags: sticker.tags,
                        reason: `SkyRush Backup restore ${id}`
                    });
                    if (created) stickerCount++;
                } catch (error) {
                    console.log(`⚠️ Không thể restore sticker ${sticker.name}:`, error.message);
                }
            }
        }

        return {
            ...(result || {}),
            emojis: emojiCount,
            stickers: stickerCount
        };
    } finally {
        try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            if (hadOldFile && oldData) fs.writeFileSync(legacyFile, oldData);
            else if (fs.existsSync(legacyFile)) fs.unlinkSync(legacyFile);
        } catch (cleanupError) {
            console.log("⚠️ Restore cleanup warning:", cleanupError.message);
        }
        restoring = false;
    }
}

serverLoadBackup.isRunning = () => restoring;
module.exports = serverLoadBackup;
