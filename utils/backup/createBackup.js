const fs = require("fs");
const path = require("path");

const generateBackupID = require("./backupID");

const backupFolder = path.join(
    __dirname,
    "..",
    "..",
    "backups"
);

// Chống /backup create và Auto Backup chạy cùng lúc.
let backupRunning = false;

function ensureBackupFolder() {
    if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder, { recursive: true });
    }
}

function getUniqueBackupID() {
    ensureBackupFolder();

    try {
        const generated = generateBackupID();

        if (
            typeof generated === "string" &&
            /^SR-\d{2}-\d{2}-\d{4}-\d{3}$/.test(generated)
        ) {
            const file = path.join(backupFolder, `${generated}.json`);
            if (!fs.existsSync(file)) return generated;
        }
    }
    catch (error) {
        console.log("⚠️ backupID.js lỗi:", error.message);
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const prefix = `SR-${day}-${month}-${year}-`;

    const files = fs.readdirSync(backupFolder);
    let maxNumber = 0;

    for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const name = file.slice(0, -5);
        if (!name.startsWith(prefix)) continue;

        const number = Number(name.slice(prefix.length));
        if (Number.isInteger(number) && number > maxNumber) {
            maxNumber = number;
        }
    }

    let nextNumber = maxNumber + 1;
    let id;

    do {
        id = prefix + String(nextNumber).padStart(3, "0");
        nextNumber++;
    }
    while (
        fs.existsSync(
            path.join(backupFolder, `${id}.json`)
        )
    );

    return id;
}

function serialize(value) {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) return value.map(serialize);

    if (value && typeof value === "object") {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = serialize(val);
        }
        return result;
    }

    return value;
}

function getRoleData(role) {
    return {
        id: role.id,
        name: role.name,
        color: role.color || 0,
        hoist: Boolean(role.hoist),
        mentionable: Boolean(role.mentionable),
        permissions: role.permissions
            ? role.permissions.bitfield.toString()
            : "0",
        position: Number(role.position || 0),
        managed: Boolean(role.managed),
        unicodeEmoji: role.unicodeEmoji || null
    };
}

function getChannelData(channel) {
    const permissionOverwrites = [];

    if (
        channel.permissionOverwrites &&
        channel.permissionOverwrites.cache
    ) {
        for (
            const overwrite of channel.permissionOverwrites.cache.values()
        ) {
            permissionOverwrites.push({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow
                    ? overwrite.allow.bitfield.toString()
                    : "0",
                deny: overwrite.deny
                    ? overwrite.deny.bitfield.toString()
                    : "0"
            });
        }
    }

    const data = {
        id: channel.id,
        name: channel.name,
        type: Number(channel.type),
        parent: channel.parentId || null,
        position: Number(
            channel.rawPosition ?? channel.position ?? 0
        ),
        topic: channel.topic || null,
        nsfw: Boolean(channel.nsfw),
        rateLimit: Number(channel.rateLimitPerUser || 0),
        bitrate: channel.bitrate ? Number(channel.bitrate) : null,
        userLimit: channel.userLimit ? Number(channel.userLimit) : null,
        permissionOverwrites
    };

    if (channel.rtcRegion) {
        data.rtcRegion = channel.rtcRegion;
    }

    if (channel.defaultAutoArchiveDuration) {
        data.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration;
    }

    if (channel.defaultThreadRateLimitPerUser) {
        data.defaultThreadRateLimitPerUser = channel.defaultThreadRateLimitPerUser;
    }

    return data;
}

function getEmojiData(emoji) {
    return {
        id: emoji.id,
        name: emoji.name,
        url: typeof emoji.imageURL === "function"
            ? emoji.imageURL()
            : null,
        animated: Boolean(emoji.animated)
    };
}

function getStickerData(sticker) {
    return {
        id: sticker.id,
        name: sticker.name,
        description: sticker.description || null,
        tags: sticker.tags || null,
        format: sticker.format,
        url: sticker.url || null
    };
}

async function performBackup(guild) {
    if (!guild) {
        throw new Error("Guild không tồn tại.");
    }

    ensureBackupFolder();

    // Không log CREATE ở đây nữa.
    // backup.js sẽ là nơi hiển thị kết quả để tránh log bị nhân đôi.

    try {
        await guild.roles.fetch();
    }
    catch (error) {
        console.log("⚠️ Không fetch được roles:", error.message);
    }

    try {
        await guild.channels.fetch();
    }
    catch (error) {
        console.log("⚠️ Không fetch được channels:", error.message);
    }

    try {
        await guild.emojis.fetch();
    }
    catch (error) {
        console.log("⚠️ Không fetch được emojis:", error.message);
    }

    try {
        await guild.stickers.fetch();
    }
    catch (error) {
        console.log("⚠️ Không fetch được stickers:", error.message);
    }

    const backupID = getUniqueBackupID();

    const backupFile = path.join(
        backupFolder,
        `${backupID}.json`
    );

    const roles = guild.roles.cache
        .sort((a, b) => a.position - b.position)
        .map(getRoleData);

    const channels = guild.channels.cache
        .sort(
            (a, b) =>
                (a.rawPosition ?? a.position ?? 0) -
                (b.rawPosition ?? b.position ?? 0)
        )
        .map(getChannelData);

    const emojis = guild.emojis.cache.map(getEmojiData);
    const stickers = guild.stickers.cache.map(getStickerData);

    const backup = {
        id: backupID,
        version: "2.0.0",
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({
                extension: "png",
                size: 1024
            }) || null,
            ownerId: guild.ownerId || null,
            verificationLevel: guild.verificationLevel,
            defaultMessageNotifications: guild.defaultMessageNotifications,
            explicitContentFilter: guild.explicitContentFilter
        },
        createdAt: new Date().toISOString(),
        roles: serialize(roles),
        channels: serialize(channels),
        emojis: serialize(emojis),
        stickers: serialize(stickers)
    };

    try {
        fs.writeFileSync(
            backupFile,
            JSON.stringify(backup, null, 4),
            {
                encoding: "utf8",
                flag: "wx"
            }
        );
    }
    catch (error) {
        if (error.code === "EEXIST") {
            throw new Error(`Backup ${backupID} đã tồn tại.`);
        }

        throw new Error(
            `Không thể lưu backup: ${error.message}`
        );
    }

    if (!fs.existsSync(backupFile)) {
        throw new Error(
            "Backup đã chạy nhưng file không được tạo."
        );
    }

    // Không log thành công ở đây vì commands/backup/backup.js đã log.
    return backup;
}

async function createBackup(guild) {
    if (backupRunning) {
        throw new Error(
            "Đang có một backup khác đang chạy. Vui lòng chờ backup hiện tại hoàn tất."
        );
    }

    backupRunning = true;

    try {
        return await performBackup(guild);
    }
    finally {
        backupRunning = false;
    }
}

createBackup.isRunning = () => backupRunning;

module.exports = createBackup;
