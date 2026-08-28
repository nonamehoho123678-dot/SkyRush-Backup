const fs = require("fs");
const path = require("path");
const loadBackup = require("./loadBackup");
const applyPermissions = require("./applyPermissions");
const { getBackupFile } = require("../backup/storage");

let restoring = false;

async function retry(fn, label = "Operation") {
    let lastError = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`⚠️ ${label} lỗi lần ${attempt}/5: ${error.message}`);
            if (attempt < 5) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    console.log(`❌ ${label} thất bại sau 5 lần. Bỏ qua.`);
    return null;
}

async function restoreRolePermissions(guild, backup) {
    if (!guild || !backup) return 0;

    await retry(() => guild.roles.fetch(), "Fetch roles before permissions");

    let applied = 0;

    for (const roleData of Array.isArray(backup.roles) ? backup.roles : []) {
        if (roleData.name === "@everyone" || roleData.name === "SkyRush Backup") continue;

        const role = guild.roles.cache.find(r => r.name === roleData.name);
        if (!role || !role.editable) continue;

        const result = await retry(
            () => role.edit({
                permissions: BigInt(String(roleData.permissions || "0")),
                reason: `SkyRush Backup restore role permissions ${backup.id || ""}`
            }),
            `Set role permission ${role.name}`
        );

        if (result) {
            applied++;
            console.log(`🔐 Role permission SET OK: ${role.name}`);
        }
    }

    const everyoneData = (Array.isArray(backup.roles) ? backup.roles : [])
        .find(r => r.name === "@everyone" || r.id === guild.id);

    if (everyoneData) {
        const result = await retry(
            () => guild.roles.everyone.edit({
                permissions: BigInt(String(everyoneData.permissions || "0")),
                reason: `SkyRush Backup restore @everyone permissions ${backup.id || ""}`
            }),
            "Set @everyone permission"
        );

        if (result) applied++;
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
            } catch {}
        }
        originalRoleEdits.clear();
    };

    const sendProgress = async (data) => {
        if (typeof onProgress !== "function") return;
        try {
            await onProgress(data);
        } catch (error) {
            console.log(`⚠️ Discord progress skip: ${error.message}`);
        }
    };

    try {
        const backup = JSON.parse(fs.readFileSync(source, "utf8"));

        if (fs.existsSync(legacyFile)) {
            hadOldFile = true;
            oldData = fs.readFileSync(legacyFile);
        }

        fs.copyFileSync(source, tempFile);
        fs.renameSync(tempFile, legacyFile);

        disableRolePermissionsDuringStructureRestore();

        // loadBackup xử lý phần cấu trúc. Tiến trình của phần này chỉ chiếm 70%.
        const structureProgress = async progress => {
            await sendProgress({
                ...progress,
                percent: Math.min(70, Math.floor((Number(progress?.percent) || 0) * 0.7)),
                stage: "structure"
            });
        };

        const result = await loadBackup(guild, id, structureProgress);

        restoreOriginalRoleMethods();

        // 70 -> 80: role permissions.
        await sendProgress({
            percent: 70,
            roles: result?.roles ?? 0,
            totalRoles: result?.totalRoles ?? (backup.roles?.length || 0),
            categories: result?.categories ?? 0,
            totalCategories: result?.totalCategories ?? (backup.channels?.filter(c => Number(c.type) === 4).length || 0),
            channels: result?.channels ?? 0,
            totalChannels: result?.totalChannels ?? 0,
            emojis: result?.emojis ?? 0,
            totalEmojis: result?.totalEmojis ?? (backup.emojis?.length || 0),
            stage: "role_permissions"
        });

        const rolePermissionCount = await restoreRolePermissions(guild, backup);

        await sendProgress({
            percent: 80,
            roles: backup.roles?.length || 0,
            totalRoles: backup.roles?.length || 0,
            categories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            totalCategories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            channels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            totalChannels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            emojis: backup.emojis?.length || 0,
            totalEmojis: backup.emojis?.length || 0,
            stage: "channel_permissions"
        });

        // 80 -> 90: category/channel permission overwrite. applyPermissions
        // đã được tách riêng để chạy sau role hierarchy + role permissions.
        const permissionResult = await retry(
            () => applyPermissions(guild, backup),
            "Apply channel/category permissions"
        );

        await sendProgress({
            percent: 90,
            roles: backup.roles?.length || 0,
            totalRoles: backup.roles?.length || 0,
            categories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            totalCategories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            channels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            totalChannels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            emojis: backup.emojis?.length || 0,
            totalEmojis: backup.emojis?.length || 0,
            stage: "extras"
        });

        let emojiCount = 0;
        let stickerCount = 0;

        if (options.name || options.icon) {
            const edit = {};
            if (options.name && backup.guild?.name) edit.name = backup.guild.name;
            if (options.icon) edit.icon = backup.guild?.icon || null;

            if (Object.keys(edit).length) {
                await retry(
                    () => guild.edit(edit),
                    "Restore server settings"
                );
            }
        }

        if (options.emojis && Array.isArray(backup.emojis)) {
            for (const emoji of backup.emojis) {
                const exists = guild.emojis.cache.find(e => e.name === emoji.name);
                if (exists || !emoji.url || !emoji.name) continue;

                const created = await retry(
                    () => guild.emojis.create({
                        attachment: emoji.url,
                        name: emoji.name,
                        reason: `SkyRush Backup restore ${id}`
                    }),
                    `Restore emoji ${emoji.name}`
                );

                if (created) emojiCount++;
            }
        }

        if (options.stickers && Array.isArray(backup.stickers)) {
            for (const sticker of backup.stickers) {
                const exists = guild.stickers.cache.find(s => s.name === sticker.name);
                if (exists || !sticker.url || !sticker.name || !sticker.tags) continue;

                const created = await retry(
                    () => guild.stickers.create({
                        file: sticker.url,
                        name: sticker.name,
                        description: sticker.description || "SkyRush Backup sticker",
                        tags: sticker.tags,
                        reason: `SkyRush Backup restore ${id}`
                    }),
                    `Restore sticker ${sticker.name}`
                );

                if (created) stickerCount++;
            }
        }

        // Chỉ báo 100% sau khi TẤT CẢ bước restore đã chạy xong.
        await sendProgress({
            percent: 100,
            roles: backup.roles?.length || 0,
            totalRoles: backup.roles?.length || 0,
            categories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            totalCategories: backup.channels?.filter(c => Number(c.type) === 4).length || 0,
            channels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            totalChannels: backup.channels?.filter(c => Number(c.type) !== 4).length || 0,
            emojis: emojiCount,
            totalEmojis: backup.emojis?.length || 0,
            stage: "complete"
        });

        return {
            ...(result || {}),
            emojis: emojiCount,
            stickers: stickerCount,
            rolePermissions: rolePermissionCount,
            channelPermissions: permissionResult?.channels || 0,
            permissionOverwrites: permissionResult?.overwrites || 0
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
