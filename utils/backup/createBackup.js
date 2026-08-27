const fs = require("fs");
const path = require("path");
const generateBackupID = require("./backupID");

let backupRunning = false;

function serialize(value) {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === "object") {
        const result = {};
        for (const [key, val] of Object.entries(value)) result[key] = serialize(val);
        return result;
    }
    return value;
}

function getRoleData(role) {
    return {
        id: role.id, name: role.name, color: role.color || 0,
        hoist: Boolean(role.hoist), mentionable: Boolean(role.mentionable),
        permissions: role.permissions ? role.permissions.bitfield.toString() : "0",
        position: Number(role.position || 0), managed: Boolean(role.managed),
        unicodeEmoji: role.unicodeEmoji || null
    };
}

function getChannelData(channel) {
    const permissionOverwrites = [];
    if (channel.permissionOverwrites?.cache) {
        for (const overwrite of channel.permissionOverwrites.cache.values()) {
            permissionOverwrites.push({
                id: overwrite.id, type: overwrite.type,
                allow: overwrite.allow ? overwrite.allow.bitfield.toString() : "0",
                deny: overwrite.deny ? overwrite.deny.bitfield.toString() : "0"
            });
        }
    }
    const data = {
        id: channel.id, name: channel.name, type: Number(channel.type),
        parent: channel.parentId || null,
        position: Number(channel.rawPosition ?? channel.position ?? 0),
        topic: channel.topic || null, nsfw: Boolean(channel.nsfw),
        rateLimit: Number(channel.rateLimitPerUser || 0),
        bitrate: channel.bitrate ? Number(channel.bitrate) : null,
        userLimit: channel.userLimit ? Number(channel.userLimit) : null,
        permissionOverwrites
    };
    if (channel.rtcRegion) data.rtcRegion = channel.rtcRegion;
    if (channel.defaultAutoArchiveDuration) data.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration;
    if (channel.defaultThreadRateLimitPerUser) data.defaultThreadRateLimitPerUser = channel.defaultThreadRateLimitPerUser;
    return data;
}

function getEmojiData(emoji) {
    return {
        id: emoji.id, name: emoji.name,
        url: typeof emoji.imageURL === "function" ? emoji.imageURL() : null,
        animated: Boolean(emoji.animated)
    };
}

function getStickerData(sticker) {
    return {
        id: sticker.id, name: sticker.name,
        description: sticker.description || null,
        tags: sticker.tags || null, format: sticker.format,
        url: sticker.url || null
    };
}

async function performBackup(guild, creatorId = null) {
    if (!guild) throw new Error("Guild không tồn tại.");

    const backupFolder = generateBackupID.ensureServerBackupFolder(guild);
    try { await guild.roles.fetch(); } catch (e) { console.log("⚠️ Không fetch được roles:", e.message); }
    try { await guild.channels.fetch(); } catch (e) { console.log("⚠️ Không fetch được channels:", e.message); }
    try { await guild.emojis.fetch(); } catch (e) { console.log("⚠️ Không fetch được emojis:", e.message); }
    try { await guild.stickers.fetch(); } catch (e) { console.log("⚠️ Không fetch được stickers:", e.message); }

    const backupID = generateBackupID(guild);
    const backupFile = path.join(backupFolder, `${backupID}.json`);
    const roles = guild.roles.cache.sort((a, b) => a.position - b.position).map(getRoleData);
    const channels = guild.channels.cache.sort((a, b) => (a.rawPosition ?? a.position ?? 0) - (b.rawPosition ?? b.position ?? 0)).map(getChannelData);
    const emojis = guild.emojis.cache.map(getEmojiData);
    const stickers = guild.stickers.cache.map(getStickerData);

    const backup = {
        id: backupID,
        version: "3.1.0",
        createdBy: creatorId || null,
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ extension: "png", size: 1024 }) || null,
            ownerId: guild.ownerId || null,
            verificationLevel: guild.verificationLevel,
            defaultMessageNotifications: guild.defaultMessageNotifications,
            explicitContentFilter: guild.explicitContentFilter
        },
        createdAt: new Date().toISOString(),
        roles: serialize(roles), channels: serialize(channels),
        emojis: serialize(emojis), stickers: serialize(stickers)
    };

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 4), { encoding: "utf8", flag: "wx" });
    return backup;
}

async function createBackup(guild, creatorId = null) {
    if (backupRunning) throw new Error("Đang có một backup khác đang chạy. Vui lòng chờ backup hiện tại hoàn tất.");
    backupRunning = true;
    try { return await performBackup(guild, creatorId); }
    finally { backupRunning = false; }
}

createBackup.isRunning = () => backupRunning;
module.exports = createBackup;
