const { ChannelType } = require("discord.js");

async function retry(fn, label = "Operation") {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`⚠️ ${label} lỗi lần ${attempt}/5: ${error.message}`);
            if (attempt < 5) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    console.log(`❌ ${label} thất bại sau 5 lần. Bỏ qua.`);
    return null;
}

/**
 * Áp dụng lại permission overwrites sau khi roles/categories/channels
 * đã được restore. Làm riêng bước này để roleMap và channel hiện tại
 * đã ổn định, tránh trường hợp set permission quá sớm.
 */
async function applyPermissions(guild, backup) {
    if (!guild || !backup) return { channels: 0, overwrites: 0 };

    await retry(() => guild.roles.fetch(), "Fetch roles for permissions");
    await retry(() => guild.channels.fetch(), "Fetch channels for permissions");
    await guild.members.fetch().catch(() => null);

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

        const result = await retry(
            () => channel.permissionOverwrites.set(
                overwrites,
                `SkyRush Backup restore permissions ${backup.id || ""}`
            ),
            `Set permissions ${data.name}`
        );

        if (result) {
            channelsApplied++;
            overwritesApplied += overwrites.length;
            console.log(`🔐 Permission SET OK: ${data.name} (${overwrites.length})`);
        }
    }

    return {
        channels: channelsApplied,
        overwrites: overwritesApplied
    };
}

module.exports = applyPermissions;
