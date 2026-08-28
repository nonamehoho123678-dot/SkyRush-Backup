const { ChannelType } = require("discord.js");

/**
 * Áp dụng lại permission overwrites sau khi roles/categories/channels
 * đã được restore. Làm riêng bước này để roleMap và channel hiện tại
 * đã ổn định, tránh trường hợp set permission quá sớm.
 */
async function applyPermissions(guild, backup) {
    if (!guild || !backup) return { channels: 0, overwrites: 0 };

    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetch().catch(() => null);

    // Map role ID của backup -> role ID hiện tại.
    const roleMap = new Map();
    for (const roleData of Array.isArray(backup.roles) ? backup.roles : []) {
        if (roleData.name === "@everyone") {
            roleMap.set(roleData.id, guild.id);
            continue;
        }

        const role = guild.roles.cache.find(r => r.name === roleData.name);
        if (role) roleMap.set(roleData.id, role.id);
    }

    const backupChannels = Array.isArray(backup.channels) ? backup.channels : [];
    const categories = backupChannels.filter(c => Number(c.type) === ChannelType.GuildCategory);

    // Backup channel ID -> channel ID hiện tại.
    const channelMap = new Map();

    for (const data of categories) {
        const current = guild.channels.cache.find(c =>
            Number(c.type) === ChannelType.GuildCategory && c.name === data.name
        );
        if (current) channelMap.set(data.id, current.id);
    }

    for (const data of backupChannels.filter(c => Number(c.type) !== ChannelType.GuildCategory)) {
        const parentId = data.parent ? channelMap.get(data.parent) : null;
        const current = guild.channels.cache.find(c => {
            if (c.name !== data.name) return false;
            if (Number(c.type) !== Number(data.type)) return false;
            return (c.parentId || null) === (parentId || null);
        }) || guild.channels.cache.find(c => c.name === data.name);

        if (current) channelMap.set(data.id, current.id);
    }

    let channelsApplied = 0;
    let overwritesApplied = 0;

    for (const data of backupChannels) {
        if (!Array.isArray(data.permissionOverwrites) || data.permissionOverwrites.length === 0) continue;

        const currentId = channelMap.get(data.id);
        const channel = currentId ? guild.channels.cache.get(currentId) : null;
        if (!channel) {
            console.log(`⚠️ Không tìm thấy channel để set permission: ${data.name}`);
            continue;
        }

        const overwrites = [];

        for (const permission of data.permissionOverwrites) {
            let targetId = null;
            const type = Number(permission.type);

            if (type === 0) {
                targetId = roleMap.get(permission.id) || null;
            } else if (type === 1) {
                // User overwrite có thể set trực tiếp bằng ID, không cần member cache.
                targetId = permission.id;
            }

            if (!targetId) {
                console.log(`⚠️ Bỏ qua permission ${permission.id} trong ${data.name}: không map được target.`);
                continue;
            }

            overwrites.push({
                id: targetId,
                type,
                allow: String(permission.allow || "0"),
                deny: String(permission.deny || "0")
            });
        }

        if (overwrites.length === 0) continue;

        try {
            // set() thay toàn bộ overwrite bằng đúng dữ liệu backup.
            // Điều này cũng xóa overwrite cũ không còn tồn tại trong backup.
            await channel.permissionOverwrites.set(
                overwrites,
                `SkyRush Backup restore permissions ${backup.id || ""}`
            );

            channelsApplied++;
            overwritesApplied += overwrites.length;
            console.log(`🔐 Permission SET OK: ${data.name} (${overwrites.length})`);
        } catch (error) {
            console.log(`❌ Permission SET lỗi: ${data.name} | ${error.message}`);
        }
    }

    return {
        channels: channelsApplied,
        overwrites: overwritesApplied
    };
}

module.exports = applyPermissions;
