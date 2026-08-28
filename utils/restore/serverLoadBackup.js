const fs = require("fs");
const path = require("path");
const loadBackup = require("./loadBackup");
const applyPermissions = require("./applyPermissions");
const { getBackupFile } = require("../backup/storage");

let restoring = false;

async function restoreRolePermissions(guild, backup) {
    if (!guild || !backup) return 0;

    await guild.roles.fetch();

    let applied = 0;

    for (const roleData of Array.isArray(backup.roles) ? backup.roles : []) {
        if (roleData.name === "@everyone" || roleData.name === "SkyRush Backup") continue;

        const role = guild.roles.cache.find(r => r.name === roleData.name);
        if (!role || !role.editable) continue;

        try {
            await role.edit({
                permissions: BigInt(String(roleData.permissions || "0")),
                reason: `SkyRush Backup restore role permissions ${backup.id || ""}`
            });
            applied++;
            console.log(`🔐 Role permission SET OK: ${role.name}`);
        } catch (error) {
            console.log(`⚠️ Không set được permission role ${role.name}: ${error.message}`);
        }
    }

    // @everyone cũng cần permission đúng theo backup.
    const everyoneData = (Array.isArray(backup.roles) ? backup.roles : [])
        .find(r => r.name === "@everyone" || r.id === guild.id);

    if (everyoneData) {
        try {
            await guild.roles.everyone.edit({
                permissions: BigInt(String(everyoneData.permissions || "0")),
                reason: `SkyRush Backup restore @everyone permissions ${backup.id || ""}`
            });
            applied++;
        } catch (error) {
            console.log(`⚠️ Không set được permission @everyone: ${error.message}`);
        }
    }

    return applied;
}

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

    // =====================================================
    // QUAN TRỌNG: loadBackup cũ set permission role ngay lúc
    // tạo/sửa role. Điều này có thể làm quyền channel bị lệch
    // trước khi hierarchy hoàn tất. Tạm thời chặn permissions
    // trong bước tạo/sửa role.
    // =====================================================
    const originalCreate = guild.roles.create.bind(guild.roles);
    const originalRoleEdits = new Map();

    const disableRolePermissionsDuringStructureRestore = () => {
        guild.roles.create = async options => {
            const safeOptions = { ...(options || {}) };
            delete safeOptions.permissions;
            return originalCreate(safeOptions);
        };

        for (const role of guild.roles.cache.values()) {
            if (!role || typeof role.edit !== "function") continue;

            const original = role.edit.bind(role);
            originalRoleEdits.set(role, original);

            role.edit = async options => {
                const safeOptions = { ...(options || {}) };
                delete safeOptions.permissions;
                return original(safeOptions);
            };
        }
    };

    const restoreOriginalRoleMethods = () => {
        guild.roles.create = originalCreate;

        for (const [role, original] of originalRoleEdits) {
            try {
                role.edit = original;
            } catch {
                // Role có thể đã bị Discord xóa/refresh; bỏ qua.
            }
        }

        originalRoleEdits.clear();
    };

    try {
        const backup = JSON.parse(fs.readFileSync(source, "utf8"));

        if (fs.existsSync(legacyFile)) {
            hadOldFile = true;
            oldData = fs.readFileSync(legacyFile);
        }

        fs.copyFileSync(source, tempFile);
        fs.renameSync(tempFile, legacyFile);

        // -----------------------------------------------------
        // BƯỚC 1: tạo/map role nhưng KHÔNG set permission role
        // -----------------------------------------------------
        disableRolePermissionsDuringStructureRestore();

        const result = await loadBackup(guild, id, onProgress);

        // -----------------------------------------------------
        // BƯỚC 2: loadBackup đã xếp role positions/hierarchy.
        // Khôi phục lại method rồi set permission role SAU CÙNG.
        // -----------------------------------------------------
        restoreOriginalRoleMethods();

        const rolePermissionCount = await restoreRolePermissions(guild, backup);
        console.log(`🔐 Role permissions restored: ${rolePermissionCount}`);

        // -----------------------------------------------------
        // BƯỚC 3: sau khi role + hierarchy + role permissions ổn
        // định, mới set permission overwrite cho category/channel.
        // -----------------------------------------------------
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
            stickers: stickerCount,
            rolePermissions: rolePermissionCount
        };
    } finally {
        restoreOriginalRoleMethods();

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
