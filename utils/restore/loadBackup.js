const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");

async function loadBackup(guild, id, onProgress = null) {
    async function retry(fn, label = "Operation") {
        let lastError = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.log(`⚠️ ${label} lỗi lần ${attempt}/5: ${error.message}`);
                if (attempt < 5) await sleep(500);
            }
        }
        console.log(`❌ ${label} thất bại sau 5 lần. Bỏ qua.`);
        return null;
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const file = path.join(__dirname, "..", "..", "backups", `${id}.json`);

    if (!fs.existsSync(file)) throw new Error(`Backup ${id} không tồn tại`);

    let backup;
    try {
        backup = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        throw new Error(`Không thể đọc backup: ${error.message}`);
    }

    const rawRoles = Array.isArray(backup.roles) ? backup.roles : [];
    const channels = Array.isArray(backup.channels) ? backup.channels : [];
    const emojis = Array.isArray(backup.emojis) ? backup.emojis : [];

    const categories = channels.filter(c => Number(c.type) === ChannelType.GuildCategory);
    const normalChannels = channels.filter(c => Number(c.type) !== ChannelType.GuildCategory);

    // Backup cũ có thể chứa cùng một role nhiều lần.
    // Chỉ restore một role cho mỗi tên, đồng thời map mọi ID trùng về role đó.
    const roles = [];
    const roleNameMap = new Map();
    for (const role of rawRoles) {
        const key = role.name === "@everyone" ? "@everyone" : String(role.name || "");
        if (!roleNameMap.has(key)) {
            roleNameMap.set(key, role);
            roles.push(role);
        }
    }

    const total = roles.length + categories.length + normalChannels.length + emojis.length;
    let completed = 0;
    let roleCount = 0;
    let categoryCount = 0;
    let channelCount = 0;
    let emojiCount = 0;

    const roleMap = {};
    const categoryMap = {};
    const channelMap = {};

    async function progress() {
        const percent = total > 0 ? Math.min(100, Math.floor(completed / total * 100)) : 100;
        const barLength = 30;
        const filled = Math.floor(percent / 100 * barLength);
        const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
        process.stdout.write(`\r[${bar}] ${percent}% | Roles ${roleCount}/${roles.length} | Categories ${categoryCount}/${categories.length} | Channels ${channelCount}/${normalChannels.length} | Emojis ${emojiCount}/${emojis.length}`);

        if (typeof onProgress === "function") {
            try {
                await onProgress({
                    percent,
                    roles: roleCount,
                    totalRoles: roles.length,
                    categories: categoryCount,
                    totalCategories: categories.length,
                    channels: channelCount,
                    totalChannels: normalChannels.length,
                    emojis: emojiCount,
                    totalEmojis: emojis.length
                });
            } catch (error) {
                console.log(`\n⚠️ Discord progress skip: ${error.message}`);
            }
        }
    }

    console.log("\n================================");
    console.log(`🔄 Restore: ${id}`);
    console.log("================================");

    await retry(() => guild.roles.fetch(), "Fetch roles");
    await retry(() => guild.channels.fetch(), "Fetch channels");
    await retry(() => guild.emojis.fetch(), "Fetch emojis");

    // =====================================================
    // 1️⃣ ROLES
    // =====================================================
    console.log("\n1️⃣ Restore roles...");

    for (const roleData of roles) {
        roleCount++;
        try {
            if (roleData.name === "@everyone") {
                roleMap[roleData.id] = guild.id;
                completed++;
                await progress();
                continue;
            }

            let existingRole;
            if (roleData.name === "SkyRush Backup") {
                existingRole = guild.roles.cache.find(r => r.name === "SkyRush Backup");
            } else {
                existingRole = guild.roles.cache.find(r => r.name === roleData.name && r.id !== guild.id);
            }

            if (existingRole) {
                console.log(`↔️ Role đã tồn tại: ${roleData.name}`);
                roleMap[roleData.id] = existingRole.id;
            } else {
                console.log(`➕ Tạo role: ${roleData.name}`);
                const newRole = await retry(() => guild.roles.create({
                    name: roleData.name,
                    colors: { primaryColor: Number(roleData.color || 0) },
                    hoist: Boolean(roleData.hoist),
                    mentionable: Boolean(roleData.mentionable),
                    permissions: BigInt(roleData.permissions || "0")
                }), `Create role ${roleData.name}`);
                if (newRole) roleMap[roleData.id] = newRole.id;
            }

            // Map mọi ID trùng tên trong backup vào cùng role.
            for (const duplicate of rawRoles) {
                if (duplicate.id !== roleData.id && duplicate.name === roleData.name) {
                    roleMap[duplicate.id] = roleMap[roleData.id];
                }
            }
        } catch (error) {
            console.log(`❌ Role lỗi: ${roleData.name} | ${error.message}`);
        }
        completed++;
        await progress();
    }

    // =====================================================
    // 2️⃣ ROLE PERMISSIONS
    // =====================================================
    console.log("\n\n2️⃣ Restore role permissions...");

    for (const roleData of roles) {
        if (roleData.name === "@everyone" || roleData.name === "SkyRush Backup") continue;

        const newId = roleMap[roleData.id];
        const role = newId ? guild.roles.cache.get(newId) : null;
        if (!role) continue;

        // Discord không cho bot chỉnh role cao hơn hoặc ngang role cao nhất của bot.
        if (!role.editable) {
            console.log(`⚠️ Bỏ qua permission role ${role.name}: role không editable / nằm trên bot.`);
            continue;
        }

        const permissions = BigInt(roleData.permissions || "0");
        const ok = await retry(
            () => role.setPermissions(permissions),
            `Set role permission ${role.name}`
        );
        if (ok) console.log(`🔐 Role permission SET OK: ${role.name}`);
    }

    // =====================================================
    // 3️⃣ CATEGORIES
    // =====================================================
    console.log("\n3️⃣ Restore categories...");

    for (const category of categories) {
        categoryCount++;
        try {
            let existing = guild.channels.cache.find(c =>
                Number(c.type) === ChannelType.GuildCategory && c.name === category.name
            );

            if (!existing) {
                console.log(`➕ Tạo category: ${category.name}`);
                existing = await retry(
                    () => guild.channels.create({ name: category.name, type: ChannelType.GuildCategory }),
                    `Create category ${category.name}`
                );
            } else {
                console.log(`↔️ Category đã tồn tại: ${category.name}`);
            }

            if (existing) {
                categoryMap[category.id] = existing.id;
                await restorePermissions(existing, category.permissionOverwrites, guild, roleMap, retry);
            }
        } catch (error) {
            console.log(`❌ Category lỗi: ${category.name} | ${error.message}`);
        }
        completed++;
        await progress();
    }

    // =====================================================
    // 4️⃣ CHANNELS
    // =====================================================
    console.log("\n4️⃣ Restore channels...");

    for (const channel of normalChannels) {
        channelCount++;
        try {
            const parentId = channel.parent ? categoryMap[channel.parent] : undefined;

            let existingChannel = guild.channels.cache.find(current =>
                current.name === channel.name &&
                Number(current.type) === Number(channel.type) &&
                (current.parentId || null) === (parentId || null)
            );

            if (!existingChannel) {
                console.log(`➕ Tạo channel: ${channel.name}`);
                let type = Number(channel.type);
                if (type === ChannelType.GuildForum || type === ChannelType.GuildMedia) type = ChannelType.GuildText;

                const options = {
                    name: channel.name,
                    type,
                    parent: parentId || undefined
                };

                if (type === ChannelType.GuildText) {
                    if (channel.topic) options.topic = channel.topic;
                    options.nsfw = Boolean(channel.nsfw);
                }

                if (channel.rateLimit && (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement)) {
                    options.rateLimitPerUser = Number(channel.rateLimit);
                }

                if (type === ChannelType.GuildVoice) {
                    if (channel.bitrate) options.bitrate = Number(channel.bitrate);
                    if (channel.userLimit) options.userLimit = Number(channel.userLimit);
                }

                existingChannel = await retry(
                    () => guild.channels.create(options),
                    `Create channel ${channel.name}`
                );
            } else {
                console.log(`↔️ Channel đã tồn tại: ${channel.name}`);
                if (parentId !== undefined && existingChannel.parentId !== parentId) {
                    await retry(() => existingChannel.setParent(parentId), `Set parent ${channel.name}`);
                }
            }

            if (existingChannel) {
                channelMap[channel.id] = existingChannel.id;
                await restorePermissions(existingChannel, channel.permissionOverwrites, guild, roleMap, retry);
            }
        } catch (error) {
            console.log(`❌ Channel lỗi: ${channel.name} | ${error.message}`);
        }
        completed++;
        await progress();
    }

    // =====================================================
    // 5️⃣ ROLE POSITIONS
    // =====================================================
    console.log("\n5️⃣ Restore role positions...");

    const botMember = guild.members.me || await retry(() => guild.members.fetchMe(), "Fetch bot member");
    const botRole = botMember?.roles?.highest;

    const positions = [];
    for (const roleData of rawRoles) {
        if (roleData.name === "@everyone") continue;
        const newId = roleMap[roleData.id];
        if (!newId || positions.some(p => p.role === newId)) continue;

        const role = guild.roles.cache.get(newId);
        if (!role || !role.editable) continue;
        if (botRole && role.position >= botRole.position) {
            console.log(`⚠️ Bỏ qua vị trí role ${role.name}: nằm ngang/trên role bot.`);
            continue;
        }

        positions.push({ role: role.id, position: Number(roleData.position || 0) });
    }

    positions.sort((a, b) => a.position - b.position);
    for (const item of positions) {
        await retry(
            () => guild.roles.setPosition(item.role, item.position),
            `Set role position ${item.role}`
        );
    }

    // =====================================================
    // 6️⃣ EMOJIS
    // =====================================================
    console.log("\n6️⃣ Restore emojis...");

    for (const emoji of emojis) {
        emojiCount++;
        try {
            const existing = guild.emojis.cache.find(e => e.name === emoji.name);
            if (existing) {
                console.log(`↔️ Emoji đã tồn tại: ${emoji.name}`);
            } else {
                const created = await retry(
                    () => guild.emojis.create({ attachment: emoji.url, name: emoji.name }),
                    `Create emoji ${emoji.name}`
                );
                if (created) console.log(`➕ Tạo emoji: ${emoji.name}`);
            }
        } catch (error) {
            console.log(`⚠️ Emoji skip: ${emoji.name} | ${error.message}`);
        }
        completed++;
        await progress();
    }

    // =====================================================
    // FINAL
    // =====================================================
    completed = total;
    roleCount = roles.length;
    categoryCount = categories.length;
    channelCount = normalChannels.length;
    emojiCount = emojis.length;

    const finalBar = "█".repeat(30);
    process.stdout.write(`\r[${finalBar}] 100% | Roles ${roleCount}/${roles.length} | Categories ${categoryCount}/${categories.length} | Channels ${channelCount}/${normalChannels.length} | Emojis ${emojiCount}/${emojis.length}\n`);

    if (typeof onProgress === "function") {
        try {
            await onProgress({
                percent: 100,
                roles: roleCount,
                totalRoles: roles.length,
                categories: categoryCount,
                totalCategories: categories.length,
                channels: channelCount,
                totalChannels: normalChannels.length,
                emojis: emojiCount,
                totalEmojis: emojis.length
            });
        } catch {}
    }

    console.log("\n================================");
    console.log("✅ RESTORE HOÀN TẤT!");
    console.log("================================");

    return { success: true, id, roles: roleCount, categories: categoryCount, channels: channelCount, emojis: emojiCount };
}

async function restorePermissions(channel, permissionOverwrites, guild, roleMap, retry) {
    if (!channel || !Array.isArray(permissionOverwrites)) return;

    console.log(`🔐 Restore permissions: ${channel.name}`);

    for (const perm of permissionOverwrites) {
        try {
            let targetId = null;

            if (Number(perm.type) === 0) {
                targetId = roleMap[perm.id];
                if (!targetId && perm.name) {
                    const role = guild.roles.cache.find(r => r.name === perm.name);
                    if (role) targetId = role.id;
                }
                if (perm.name === "@everyone") targetId = guild.id;
            } else if (Number(perm.type) === 1) {
                const member = guild.members.cache.get(perm.id);
                if (member) targetId = member.id;
                else {
                    console.log(`⚠️ User permission skip: ${perm.id}`);
                    continue;
                }
            } else {
                console.log(`⚠️ Permission type không hỗ trợ: ${perm.type}`);
                continue;
            }

            if (!targetId) {
                console.log(`⚠️ Không tìm được target permission: ${perm.id}`);
                continue;
            }

            const allow = BigInt(perm.allow || "0");
            const deny = BigInt(perm.deny || "0");
            const result = await retryPermission(channel, targetId, allow, deny);

            if (result) console.log(`🔐 Permission OK: ${perm.name || targetId}`);
        } catch (error) {
            console.log(`⚠️ Permission skip: ${perm.name || perm.id} | ${error.message}`);
        }
    }
}

async function retryPermission(channel, targetId, allow, deny) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            await channel.permissionOverwrites.edit(targetId, { allow, deny });
            return true;
        } catch (error) {
            console.log(`⚠️ Permission lỗi ${attempt}/5: ${error.message}`);
            if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.log("❌ Permission thất bại sau 5 lần. Bỏ qua.");
    return false;
}

module.exports = loadBackup;
