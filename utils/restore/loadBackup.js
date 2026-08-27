const fs = require("fs");
const path = require("path");

const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");


/*
=========================================================
LOAD BACKUP
=========================================================
*/

async function loadBackup(guild, id, onProgress = null) {

    // =====================================================
    // RETRY 5 LẦN
    // =====================================================

    async function retry(fn, label = "Operation") {

        let lastError = null;

        for (let attempt = 1; attempt <= 5; attempt++) {

            try {

                return await fn();

            }
            catch (error) {

                lastError = error;

                console.log(
                    `⚠️ ${label} lỗi lần ${attempt}/5: ${error.message}`
                );


                if (attempt < 5) {

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                500
                            )
                    );

                }

            }

        }


        console.log(
            `❌ ${label} thất bại sau 5 lần. Bỏ qua.`
        );


        return null;

    }


    // =====================================================
    // ĐỌC BACKUP
    // =====================================================

    const file = path.join(
        __dirname,
        "..",
        "..",
        "backups",
        `${id}.json`
    );


    if (!fs.existsSync(file)) {

        throw new Error(
            `Backup ${id} không tồn tại`
        );

    }


    let backup;

    try {

        backup = JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    }
    catch (error) {

        throw new Error(
            `Không thể đọc backup: ${error.message}`
        );

    }


    // =====================================================
    // DATA
    // =====================================================

    const roles =
        Array.isArray(backup.roles)
            ? backup.roles
            : [];


    const channels =
        Array.isArray(backup.channels)
            ? backup.channels
            : [];


    const emojis =
        Array.isArray(backup.emojis)
            ? backup.emojis
            : [];


    // =====================================================
    // CATEGORY
    // =====================================================

    const categories =
        channels.filter(
            channel =>
                Number(channel.type) ===
                ChannelType.GuildCategory
        );


    // =====================================================
    // NORMAL CHANNEL
    // =====================================================

    const normalChannels =
        channels.filter(
            channel =>
                Number(channel.type) !==
                ChannelType.GuildCategory
        );


    // =====================================================
    // TOTAL
    // =====================================================

    const total =
        roles.length +
        categories.length +
        normalChannels.length +
        emojis.length;


    let completed = 0;

    let roleCount = 0;

    let categoryCount = 0;

    let channelCount = 0;

    let emojiCount = 0;


    // =====================================================
    // PROGRESS
    // =====================================================

    async function progress() {

        completed++;


        const percent =
            total > 0
                ? Math.min(
                    100,
                    Math.floor(
                        completed /
                        total *
                        100
                    )
                )
                : 100;


        // =================================================
        // TERMINAL BAR
        // =================================================

        const barLength = 30;


        const filled =
            Math.floor(
                percent /
                100 *
                barLength
            );


        const bar =
            "█".repeat(filled) +
            "░".repeat(
                barLength - filled
            );


        process.stdout.write(

            "\r" +

            `[${bar}] ${percent}% | ` +

            `Roles ${roleCount}/${roles.length} | ` +

            `Categories ${categoryCount}/${categories.length} | ` +

            `Channels ${channelCount}/${normalChannels.length} | ` +

            `Emojis ${emojiCount}/${emojis.length}`

        );


        // =================================================
        // DISCORD
        // =================================================

        if (
            typeof onProgress ===
            "function"
        ) {

            try {

                await onProgress({

                    percent,

                    roles:
                        roleCount,

                    totalRoles:
                        roles.length,

                    categories:
                        categoryCount,

                    totalCategories:
                        categories.length,

                    channels:
                        channelCount,

                    totalChannels:
                        normalChannels.length,

                    emojis:
                        emojiCount,

                    totalEmojis:
                        emojis.length

                });

            }
            catch (error) {

                console.log(
                    "\n⚠️ Discord progress skip:",
                    error.message
                );

            }

        }

    }


    // =====================================================
    // START
    // =====================================================

    console.log("");

    console.log(
        "================================"
    );

    console.log(
        `🔄 Restore: ${id}`
    );

    console.log(
        "================================"
    );


    // =====================================================
    // MAP
    // =====================================================

    const roleMap = {};

    const categoryMap = {};

    const channelMap = {};


    // =====================================================
    // FETCH
    // =====================================================

    await retry(
        () =>
            guild.roles.fetch(),
        "Fetch roles"
    );


    await retry(
        () =>
            guild.channels.fetch(),
        "Fetch channels"
    );


    await retry(
        () =>
            guild.emojis.fetch(),
        "Fetch emojis"
    );


    // =====================================================
    // 1️⃣ ROLES
    // =====================================================

    console.log("");

    console.log(
        "1️⃣ Restore roles..."
    );


    for (
        const roleData
        of roles
    ) {

        roleCount++;


        try {

            // =============================================
            // EVERYONE
            // =============================================

            if (
                roleData.name ===
                "@everyone"
            ) {

                roleMap[
                    roleData.id
                ] = guild.id;


                await progress();

                continue;

            }


            // =============================================
            // SKYRUSH BACKUP
            // =============================================

            if (
                roleData.name ===
                "SkyRush Backup"
            ) {

                const existing =
                    guild.roles.cache.find(
                        role =>
                            role.name ===
                            "SkyRush Backup"
                    );


                if (existing) {

                    roleMap[
                        roleData.id
                    ] = existing.id;


                    console.log(
                        "↔️ Giữ role: SkyRush Backup"
                    );

                }
                else {

                    console.log(
                        "⚠️ Không tìm thấy role SkyRush Backup"
                    );

                }


                await progress();

                continue;

            }


            // =============================================
            // FIND SAME NAME
            // =============================================

            const existingRole =
                guild.roles.cache.find(
                    role =>
                        role.name ===
                        roleData.name &&
                        role.id !==
                        guild.id
                );


            // =============================================
            // EXISTING
            // =============================================

            if (existingRole) {

                console.log(
                    `↔️ Role đã tồn tại: ${roleData.name}`
                );


                roleMap[
                    roleData.id
                ] = existingRole.id;


                await retry(

                    () =>
                        existingRole.edit({

                            name:
                                roleData.name,

                            colors: {

                                primaryColor:
                                    Number(
                                        roleData.color ||
                                        0
                                    )

                            },

                            hoist:
                                Boolean(
                                    roleData.hoist
                                ),

                            mentionable:
                                Boolean(
                                    roleData.mentionable
                                ),

                            permissions:
                                BigInt(
                                    roleData.permissions ||
                                    "0"
                                )

                        }),

                    `Update role ${roleData.name}`

                );

            }


            // =============================================
            // CREATE
            // =============================================

            else {

                console.log(
                    `➕ Tạo role: ${roleData.name}`
                );


                const newRole =
                    await retry(

                        () =>
                            guild.roles.create({

                                name:
                                    roleData.name,

                                colors: {

                                    primaryColor:
                                        Number(
                                            roleData.color ||
                                            0
                                        )

                                },

                                hoist:
                                    Boolean(
                                        roleData.hoist
                                    ),

                                mentionable:
                                    Boolean(
                                        roleData.mentionable
                                    ),

                                permissions:
                                    BigInt(
                                        roleData.permissions ||
                                        "0"
                                    )

                            }),

                        `Create role ${roleData.name}`

                    );


                if (newRole) {

                    roleMap[
                        roleData.id
                    ] = newRole.id;

                }

            }

        }
        catch (error) {

            console.log(
                `❌ Role lỗi: ${roleData.name} | ${error.message}`
            );

        }


        await progress();

    }


    // =====================================================
    // 2️⃣ CATEGORY
    // =====================================================

    console.log("");

    console.log(
        "2️⃣ Restore categories..."
    );


    for (
        const category
        of categories
    ) {

        categoryCount++;


        try {

            // =============================================
            // FIND SAME CATEGORY
            // =============================================

            let existing =
                guild.channels.cache.find(
                    channel =>
                        Number(channel.type) ===
                        ChannelType.GuildCategory &&
                        channel.name ===
                        category.name
                );


            // =============================================
            // CREATE
            // =============================================

            if (!existing) {

                console.log(
                    `➕ Tạo category: ${category.name}`
                );


                existing =
                    await retry(

                        () =>
                            guild.channels.create({

                                name:
                                    category.name,

                                type:
                                    ChannelType.GuildCategory

                            }),

                        `Create category ${category.name}`

                    );

            }
            else {

                console.log(
                    `↔️ Category đã tồn tại: ${category.name}`
                );

            }


            // =============================================
            // MAP
            // =============================================

            if (existing) {

                categoryMap[
                    category.id
                ] = existing.id;

            }


            // =============================================
            // CATEGORY PERMISSIONS
            // =============================================

            if (
                existing &&
                Array.isArray(
                    category.permissionOverwrites
                )
            ) {

                await restorePermissions(
                    existing,
                    category.permissionOverwrites,
                    guild,
                    roleMap
                );

            }

        }
        catch (error) {

            console.log(
                `❌ Category lỗi: ${category.name} | ${error.message}`
            );

        }


        await progress();

    }


    // =====================================================
    // 3️⃣ CHANNELS
    // =====================================================

    console.log("");

    console.log(
        "3️⃣ Restore channels..."
    );


    for (
        const channel
        of normalChannels
    ) {

        channelCount++;


        try {

            // =============================================
            // PARENT
            // =============================================

            let parentId =
                undefined;


            if (
                channel.parent
            ) {

                parentId =
                    categoryMap[
                        channel.parent
                    ];

            }


            // =============================================
            // FIND EXISTING
            // =============================================

            let existingChannel =
                guild.channels.cache.find(

                    current => {

                        const sameName =
                            current.name ===
                            channel.name;


                        const sameType =
                            Number(
                                current.type
                            ) ===
                            Number(
                                channel.type
                            );


                        const sameParent =
                            (
                                current.parentId ||
                                null
                            ) ===
                            (
                                parentId ||
                                null
                            );


                        return (
                            sameName &&
                            sameType &&
                            sameParent
                        );

                    }

                );


            // =============================================
            // CREATE
            // =============================================

            if (!existingChannel) {

                console.log(
                    `➕ Tạo channel: ${channel.name}`
                );


                let type =
                    Number(
                        channel.type
                    );


                // =========================================
                // UNSUPPORTED TYPES
                // =========================================

                if (
                    type ===
                    ChannelType.GuildForum ||

                    type ===
                    ChannelType.GuildMedia
                ) {

                    /*
                     * Discord.js / API có thể không hỗ trợ
                     * restore một số loại channel tùy server.
                     *
                     * Dùng text channel thay thế.
                     */

                    type =
                        ChannelType.GuildText;

                }


                // =========================================
                // OPTIONS
                // =========================================

                const options = {

                    name:
                        channel.name,

                    type:
                        type,

                    parent:
                        parentId ||
                        undefined

                };


                // =========================================
                // TOPIC
                // =========================================

                if (
                    type ===
                    ChannelType.GuildText &&
                    channel.topic
                ) {

                    options.topic =
                        channel.topic;

                }


                // =========================================
                // NSFW
                // =========================================

                if (
                    type ===
                    ChannelType.GuildText
                ) {

                    options.nsfw =
                        Boolean(
                            channel.nsfw
                        );

                }


                // =========================================
                // SLOWMODE
                // =========================================

                if (
                    channel.rateLimit &&
                    (
                        type ===
                        ChannelType.GuildText ||

                        type ===
                        ChannelType.GuildAnnouncement
                    )
                ) {

                    options.rateLimitPerUser =
                        Number(
                            channel.rateLimit
                        );

                }


                // =========================================
                // VOICE
                // =========================================

                if (
                    type ===
                    ChannelType.GuildVoice
                ) {

                    if (
                        channel.bitrate
                    ) {

                        options.bitrate =
                            Number(
                                channel.bitrate
                            );

                    }


                    if (
                        channel.userLimit
                    ) {

                        options.userLimit =
                            Number(
                                channel.userLimit
                            );

                    }

                }


                // =========================================
                // CREATE
                // =========================================

                existingChannel =
                    await retry(

                        () =>
                            guild.channels.create(
                                options
                            ),

                        `Create channel ${channel.name}`

                    );

            }
            else {

                console.log(
                    `↔️ Channel đã tồn tại: ${channel.name}`
                );


                // =========================================
                // ĐƯA VỀ ĐÚNG CATEGORY
                // =========================================

                if (
                    parentId !== undefined &&
                    existingChannel.parentId !==
                    parentId
                ) {

                    await retry(

                        () =>
                            existingChannel.setParent(
                                parentId
                            ),

                        `Set parent ${channel.name}`

                    );

                }

            }


            // =============================================
            // MAP CHANNEL
            // =============================================

            if (existingChannel) {

                channelMap[
                    channel.id
                ] =
                    existingChannel.id;

            }


            // =============================================
            // PERMISSIONS
            // =============================================

            if (
                existingChannel &&
                Array.isArray(
                    channel.permissionOverwrites
                )
            ) {

                await restorePermissions(

                    existingChannel,

                    channel.permissionOverwrites,

                    guild,

                    roleMap

                );

            }

        }
        catch (error) {

            console.log(
                `❌ Channel lỗi: ${channel.name} | ${error.message}`
            );

        }


        await progress();

    }


    // =====================================================
    // 4️⃣ ROLE POSITIONS
    // =====================================================

    console.log("");

    console.log(
        "4️⃣ Restore role positions..."
    );


    try {

        const positions = [];


        for (
            const roleData
            of roles
        ) {

            if (
                roleData.name ===
                "@everyone"
            ) {

                continue;

            }


            const newId =
                roleMap[
                    roleData.id
                ];


            if (!newId) {

                continue;

            }


            const role =
                guild.roles.cache.get(
                    newId
                );


            if (
                !role ||
                !role.editable
            ) {

                continue;

            }


            positions.push({

                role:
                    role.id,

                position:
                    Number(
                        roleData.position ||
                        0
                    )

            });

        }


        positions.sort(
            (a, b) =>
                a.position -
                b.position
        );


        for (
            const item
            of positions
        ) {

            await retry(

                () =>
                    guild.roles.setPosition(

                        item.role,

                        item.position

                    ),

                `Set role position ${item.role}`

            );

        }

    }
    catch (error) {

        console.log(
            `⚠️ Role position skip: ${error.message}`
        );

    }


    // =====================================================
    // 5️⃣ EMOJIS
    // =====================================================

    console.log("");

    console.log(
        "5️⃣ Restore emojis..."
    );


    for (
        const emoji
        of emojis
    ) {

        emojiCount++;


        try {

            const existing =
                guild.emojis.cache.find(
                    e =>
                        e.name ===
                        emoji.name
                );


            if (existing) {

                console.log(
                    `↔️ Emoji đã tồn tại: ${emoji.name}`
                );

            }
            else {

                const created =
                    await retry(

                        () =>
                            guild.emojis.create({

                                attachment:
                                    emoji.url,

                                name:
                                    emoji.name

                            }),

                        `Create emoji ${emoji.name}`

                    );


                if (created) {

                    console.log(
                        `➕ Tạo emoji: ${emoji.name}`
                    );

                }

            }

        }
        catch (error) {

            console.log(
                `⚠️ Emoji skip: ${emoji.name} | ${error.message}`
            );

        }


        await progress();

    }


    // =====================================================
    // 100%
    // =====================================================

    completed =
        total;


    roleCount =
        roles.length;


    categoryCount =
        categories.length;


    channelCount =
        normalChannels.length;


    emojiCount =
        emojis.length;


    const finalBar =
        "█".repeat(30);


    process.stdout.write(

        "\r" +

        `[${finalBar}] 100% | ` +

        `Roles ${roleCount}/${roles.length} | ` +

        `Categories ${categoryCount}/${categories.length} | ` +

        `Channels ${channelCount}/${normalChannels.length} | ` +

        `Emojis ${emojiCount}/${emojis.length}\n`

    );


    // =====================================================
    // DISCORD FINAL 100%
    // =====================================================

    if (
        typeof onProgress ===
        "function"
    ) {

        try {

            await onProgress({

                percent: 100,

                roles:
                    roleCount,

                totalRoles:
                    roles.length,

                categories:
                    categoryCount,

                totalCategories:
                    categories.length,

                channels:
                    channelCount,

                totalChannels:
                    normalChannels.length,

                emojis:
                    emojiCount,

                totalEmojis:
                    emojis.length

            });

        }
        catch {

            // Không làm restore fail
        }

    }


    // =====================================================
    // COMPLETE
    // =====================================================

    console.log("");

    console.log(
        "================================"
    );

    console.log(
        "✅ RESTORE HOÀN TẤT!"
    );

    console.log(
        "================================"
    );


    return {

        success:
            true,

        id,

        roles:
            roleCount,

        categories:
            categoryCount,

        channels:
            channelCount,

        emojis:
            emojiCount

    };

}


/*
=========================================================
RESTORE PERMISSIONS
=========================================================
*/

async function restorePermissions(
    channel,
    permissionOverwrites,
    guild,
    roleMap
) {

    if (
        !channel ||
        !Array.isArray(
            permissionOverwrites
        )
    ) {

        return;

    }


    console.log(
        `🔐 Restore permissions: ${channel.name}`
    );


    // =====================================================
    // XỬ LÝ TỪNG OVERWRITE
    // =====================================================

    for (
        const perm
        of permissionOverwrites
    ) {

        try {

            let targetId =
                null;


            // =================================================
            // ROLE
            // =================================================

            if (
                Number(perm.type) === 0
            ) {

                /*
                 * Ưu tiên map ID backup
                 */

                targetId =
                    roleMap[
                        perm.id
                    ];


                /*
                 * Nếu không có map thì tìm
                 * role theo tên
                 */

                if (
                    !targetId &&
                    perm.name
                ) {

                    const role =
                        guild.roles.cache.find(
                            r =>
                                r.name ===
                                perm.name
                        );


                    if (role) {

                        targetId =
                            role.id;

                    }

                }


                /*
                 * @everyone
                 */

                if (
                    perm.name ===
                    "@everyone"
                ) {

                    targetId =
                        guild.id;

                }

            }


            // =================================================
            // USER
            // =================================================

            else if (
                Number(perm.type) === 1
            ) {

                /*
                 * User permission chỉ restore
                 * nếu user còn trong server.
                 */

                const member =
                    guild.members.cache.get(
                        perm.id
                    );


                if (member) {

                    targetId =
                        member.id;

                }
                else {

                    console.log(
                        `⚠️ User permission skip: ${perm.id}`
                    );

                    continue;

                }

            }


            // =================================================
            // UNKNOWN
            // =================================================

            else {

                console.log(
                    `⚠️ Permission type không hỗ trợ: ${perm.type}`
                );

                continue;

            }


            // =================================================
            // KHÔNG TÌM ĐƯỢC TARGET
            // =================================================

            if (!targetId) {

                console.log(
                    `⚠️ Không tìm được target permission: ${perm.id}`
                );

                continue;

            }


            // =================================================
            // ALLOW / DENY
            // =================================================

            const allow =
                BigInt(
                    perm.allow ||
                    "0"
                );


            const deny =
                BigInt(
                    perm.deny ||
                    "0"
                );


            // =================================================
            // SET PERMISSION
            // =================================================

            const result =
                await retryPermission(

                    channel,

                    targetId,

                    allow,

                    deny

                );


            if (result) {

                console.log(
                    `🔐 Permission OK: ${perm.name || targetId}`
                );

            }

        }
        catch (error) {

            console.log(
                `⚠️ Permission skip: ${perm.name || perm.id} | ${error.message}`
            );

        }

    }

}


/*
=========================================================
RETRY PERMISSION 5 LẦN
=========================================================
*/

async function retryPermission(
    channel,
    targetId,
    allow,
    deny
) {

    let lastError =
        null;


    for (
        let attempt = 1;
        attempt <= 5;
        attempt++
    ) {

        try {

            /*
             * edit() sẽ tạo overwrite nếu chưa có
             * hoặc cập nhật overwrite hiện tại.
             */

            await channel.permissionOverwrites.edit(

                targetId,

                {

                    allow,

                    deny

                }

            );


            return true;

        }
        catch (error) {

            lastError =
                error;


            console.log(

                `⚠️ Permission lỗi ${attempt}/5: ` +

                `${error.message}`

            );


            if (
                attempt < 5
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            500
                        )
                );

            }

        }

    }


    console.log(
        `❌ Permission thất bại sau 5 lần: ${lastError?.message || "Unknown"}`
    );


    return false;

}


/*
=========================================================
EXPORT
=========================================================
*/

module.exports =
    loadBackup;