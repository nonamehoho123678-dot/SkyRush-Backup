const {
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const {
    successEmbed,
    errorEmbed,
    infoEmbed
} = require("../../utils/embed");

const createBackup =
    require("../../utils/backup/createBackup");

const loadBackup =
    require("../../utils/restore/loadBackup");

const backupSelect =
    require("../../components/menus/backupSelect");


// =========================================================
// 📁 BACKUP FOLDER
// =========================================================

const backupFolder =
    path.join(
        __dirname,
        "..",
        "..",
        "backups"
    );


// =========================================================
// 📅 NGÀY HIỆN TẠI
// =========================================================

function getTodayString() {

    const now = new Date();

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const year =
        now.getFullYear();

    return `${day}-${month}-${year}`;

}


// =========================================================
// 🛡️ KIỂM TRA INTERACTION
// =========================================================

function interactionAlive(interaction) {

    return (
        interaction &&
        !interaction.deleted
    );

}


// =========================================================
// 📊 PROGRESS BAR
// =========================================================

function createProgressBar(percent) {

    const length = 30;

    const safePercent =
        Math.max(
            0,
            Math.min(
                100,
                Number(percent) || 0
            )
        );

    const filled =
        Math.floor(
            safePercent /
            100 *
            length
        );

    return (
        "█".repeat(filled) +
        "░".repeat(
            length - filled
        )
    );

}


// =========================================================
// 📝 PROGRESS TEXT
// =========================================================

function createProgressText(
    id,
    progress
) {

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    progress.percent
                ) || 0
            )
        );

    const bar =
        createProgressBar(
            percent
        );

    return (
        `🔄 **Restore: \`${id}\`**\n\n` +

        `\`[${bar}] ${percent}%\`\n\n` +

        `🎭 Roles: **${progress.roles || 0}/${progress.totalRoles || 0}**\n` +

        `📁 Categories: **${progress.categories || 0}/${progress.totalCategories || 0}**\n` +

        `💬 Channels: **${progress.channels || 0}/${progress.totalChannels || 0}**\n` +

        `😀 Emojis: **${progress.emojis || 0}/${progress.totalEmojis || 0}**\n\n` +

        "⏳ **Đang khôi phục...**"
    );

}


// =========================================================
// 📦 COMMAND
// =========================================================

module.exports = {

    // =====================================================
    // SLASH COMMAND
    // =====================================================

    data:

        new SlashCommandBuilder()

            .setName("backup")

            .setDescription(
                "Quản lý backup server"
            )


            // =================================================
            // CREATE
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("create")
                        .setDescription(
                            "Tạo backup server"
                        )
            )


            // =================================================
            // LIST
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("list")
                        .setDescription(
                            "Xem danh sách backup"
                        )
            )


            // =================================================
            // INFO
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("info")
                        .setDescription(
                            "Xem thông tin backup"
                        )

                        .addStringOption(
                            option =>
                                option
                                    .setName("id")
                                    .setDescription(
                                        "Backup ID"
                                    )
                                    .setRequired(true)
                        )
            )


            // =================================================
            // DELETE
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("delete")
                        .setDescription(
                            "Xóa backup"
                        )

                        .addStringOption(
                            option =>
                                option
                                    .setName("id")
                                    .setDescription(
                                        "Backup ID"
                                    )
                                    .setRequired(true)
                        )
            )


            // =================================================
            // LOAD
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("load")
                        .setDescription(
                            "Khôi phục backup"
                        )

                        .addStringOption(
                            option =>
                                option
                                    .setName("id")
                                    .setDescription(
                                        "Backup ID"
                                    )
                                    .setRequired(true)
                        )
            )


            // =================================================
            // PANEL
            // =================================================

            .addSubcommand(
                sub =>
                    sub
                        .setName("panel")
                        .setDescription(
                            "Mở bảng điều khiển backup"
                        )
            ),


    // =====================================================
    // EXECUTE
    // =====================================================

    async execute(interaction) {

        const sub =
            interaction.options.getSubcommand();


        // =================================================
        // 🎛️ PANEL
        // =================================================

        if (sub === "panel") {

            return interaction.reply({

                content:
                    "⚡ **SkyRush Backup Panel**\n\n" +
                    "📦 Chọn backup cần quản lý:",

                components: [

                    backupSelect()

                ]

            });

        }


        // =================================================
        // 📦 CREATE
        // =================================================

        if (sub === "create") {

            await interaction.deferReply();


            try {

                console.log("");
                console.log(
                    "================================"
                );

                console.log(
                    "📦 CREATE BACKUP"
                );

                console.log(
                    `🏠 ${interaction.guild.name}`
                );

                console.log(
                    "================================"
                );


                // =================================================
                // CREATE BACKUP
                // =================================================
                //
                // createBackup.js tự tạo ID.
                // KHÔNG truyền backupID vào đây.
                //

                const backup =
                    await createBackup(
                        interaction.guild
                    );


                console.log(
                    "================================"
                );

                console.log(
                    `✅ Backup created: ${backup.id}`
                );

                console.log(
                    `🎭 Roles: ${backup.roles?.length || 0}`
                );

                console.log(
                    `💬 Channels: ${backup.channels?.length || 0}`
                );

                console.log(
                    `😀 Emojis: ${backup.emojis?.length || 0}`
                );

                console.log(
                    `🏷 Stickers: ${backup.stickers?.length || 0}`
                );

                console.log(
                    "================================"
                );


                // =================================================
                // KIỂM TRA BACKUP
                // =================================================

                if (
                    !backup ||
                    !backup.id
                ) {

                    throw new Error(
                        "createBackup không trả về Backup ID."
                    );

                }


                // =================================================
                // 🎉 THÀNH CÔNG
                // =================================================
                //
                // Dùng followUp thay vì editReply.
                // Tránh lỗi:
                // DiscordAPIError[10008]: Unknown Message
                //

                try {

                    return await interaction.followUp({

                        embeds: [

                            successEmbed(

                                "Backup Created",

                                `
🆔 **ID**
\`${backup.id}\`

🏠 **Server**
${backup.guild?.name || interaction.guild.name}

📊 **Data**

🎭 Roles: **${backup.roles?.length || 0}**

💬 Channels: **${backup.channels?.length || 0}**

😀 Emojis: **${backup.emojis?.length || 0}**

🏷 Stickers: **${backup.stickers?.length || 0}**

📅 **Created**
${backup.createdAt || new Date().toISOString()}

✅ **Backup đã được tạo thành công!**
`

                            )

                        ]

                    });

                }
                catch (replyError) {

                    console.error(
                        "⚠️ Không thể gửi kết quả backup:",
                        replyError.message
                    );

                    return null;

                }

            }
            catch (error) {

                console.error("");
                console.error(
                    "================================"
                );

                console.error(
                    "❌ CREATE BACKUP ERROR"
                );

                console.error(
                    error
                );

                console.error(
                    "================================"
                );


                // =================================================
                // GỬI LỖI
                // =================================================

                try {

                    return await interaction.followUp({

                        embeds: [

                            errorEmbed(

                                "Backup Failed",

                                `
❌ **Không thể tạo backup.**

⚠️ Lỗi:

\`${error.message || "Unknown error"}\`
`

                            )

                        ]

                    });

                }
                catch (replyError) {

                    console.error(
                        "❌ Không thể gửi lỗi Discord:",
                        replyError.message
                    );

                    return null;

                }

            }

        }


        // =================================================
        // 📋 LIST
        // =================================================

        if (sub === "list") {

            try {

                if (
                    !fs.existsSync(
                        backupFolder
                    )
                ) {

                    return interaction.reply({

                        embeds: [

                            errorEmbed(

                                "Không có backup",

                                "Chưa tạo backup nào."

                            )

                        ],

                        ephemeral: true

                    });

                }


                const files =
                    fs.readdirSync(
                        backupFolder
                    )

                    .filter(
                        file =>
                            file.endsWith(".json")
                    )

                    .sort(
                        (a, b) =>
                            b.localeCompare(a)
                    );


                return interaction.reply({

                    embeds: [

                        infoEmbed(

                            "📦 SkyRush Backups",

                            files.length

                                ?

                                files
                                    .map(
                                        file =>
                                            `📦 \`${file.replace(".json", "")}\``
                                    )
                                    .join("\n")

                                :

                                "Không có backup."

                        )

                    ]

                });

            }
            catch (error) {

                console.error(
                    "❌ LIST BACKUP ERROR:",
                    error
                );

                return interaction.reply({

                    embeds: [

                        errorEmbed(

                            "List Failed",

                            error.message

                        )

                    ],

                    ephemeral: true

                });

            }

        }


        // =================================================
        // 🔄 LOAD / RESTORE
        // =================================================

        if (sub === "load") {

            await interaction.deferReply();


            const id =
                interaction.options.getString(
                    "id"
                );


            // =================================================
            // FILE
            // =================================================

            const backupFile =
                path.join(

                    backupFolder,

                    `${id}.json`

                );


            // =================================================
            // CHECK
            // =================================================

            if (
                !fs.existsSync(
                    backupFile
                )
            ) {

                return interaction.editReply({

                    content:
                        null,

                    embeds: [

                        errorEmbed(

                            "Restore Failed",

                            `
❌ Backup \`${id}\` không tồn tại.
`

                        )

                    ],

                    components: []

                });

            }


            // =================================================
            // PROGRESS
            // =================================================

            let lastPercent = -1;

            let updating = false;

            let pendingProgress = null;


            // =================================================
            // UPDATE DISCORD
            // =================================================

            async function updateDiscordProgress(
                progress
            ) {

                pendingProgress =
                    progress;


                if (updating) {

                    return;

                }


                updating = true;


                try {

                    while (
                        pendingProgress
                    ) {

                        const current =
                            pendingProgress;


                        pendingProgress =
                            null;


                        const percent =
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    Number(
                                        current.percent
                                    ) || 0
                                )
                            );


                        // =========================================
                        // Không update cùng một %
                        // =========================================

                        if (
                            percent ===
                            lastPercent
                        ) {

                            continue;

                        }


                        lastPercent =
                            percent;


                        // =========================================
                        // EDIT
                        // =========================================

                        try {

                            await interaction.editReply({

                                content:
                                    createProgressText(
                                        id,
                                        current
                                    ),

                                embeds: [],

                                components: []

                            });

                        }
                        catch (error) {

                            console.log(
                                "\n⚠️ Discord progress update skip:",
                                error.message
                            );

                        }


                        // =========================================
                        // DELAY
                        // =========================================

                        await new Promise(
                            resolve =>
                                setTimeout(
                                    resolve,
                                    200
                                )
                        );

                    }

                }
                finally {

                    updating = false;

                }

            }


            // =================================================
            // BẮT ĐẦU RESTORE
            // =================================================

            try {

                await interaction.editReply({

                    content:
                        `🔄 **Restore: \`${id}\`**\n\n` +

                        "`[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%`\n\n" +

                        "🎭 Roles: **0**\n" +

                        "📁 Categories: **0**\n" +

                        "💬 Channels: **0**\n" +

                        "😀 Emojis: **0**\n\n" +

                        "⏳ **Đang bắt đầu restore...**",

                    embeds: [],

                    components: []

                });


                // =================================================
                // LOAD BACKUP
                // =================================================

                const result =
                    await loadBackup(

                        interaction.guild,

                        id,

                        async progress => {

                            await updateDiscordProgress(
                                progress
                            );

                        }

                    );


                // =================================================
                // 100%
                // =================================================

                await updateDiscordProgress({

                    percent: 100,

                    roles:
                        result.roles,

                    totalRoles:
                        result.roles,

                    categories:
                        result.categories,

                    totalCategories:
                        result.categories,

                    channels:
                        result.channels,

                    totalChannels:
                        result.channels,

                    emojis:
                        result.emojis,

                    totalEmojis:
                        result.emojis

                });


                // =================================================
                // ĐỢI DISCORD UPDATE
                // =================================================

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            500
                        )
                );


                // =================================================
                // SUCCESS
                // =================================================

                try {

                    return await interaction.editReply({

                        content:
                            null,

                        embeds: [

                            successEmbed(

                                "Restore thành công",

                                `
✅ **Restore thành công!**

🆔 **Backup**
\`${id}\`

🏠 **Server**
${interaction.guild.name}

🎭 Roles: **${result.roles}**

📁 Categories: **${result.categories}**

💬 Channels: **${result.channels}**

😀 Emojis: **${result.emojis}**

📊 **Tiến trình: 100%**
`

                            )

                        ],

                        components: []

                    });

                }
                catch (editError) {

                    console.error(
                        "⚠️ Không thể hiện kết quả restore:",
                        editError.message
                    );

                    return null;

                }

            }
            catch (error) {

                console.error("");
                console.error(
                    "================================"
                );

                console.error(
                    "❌ RESTORE ERROR"
                );

                console.error(
                    error
                );

                console.error(
                    "================================"
                );


                try {

                    return await interaction.editReply({

                        content:
                            null,

                        embeds: [

                            errorEmbed(

                                "Restore Failed",

                                `
❌ **Khôi phục backup thất bại.**

🆔 **Backup**
\`${id}\`

⚠️ **Lỗi**
\`${error.message || "Unknown error"}\`
`

                            )

                        ],

                        components: []

                    });

                }
                catch (editError) {

                    console.error(
                        "❌ Không thể gửi lỗi restore:",
                        editError.message
                    );

                    return null;

                }

            }

        }


        // =================================================
        // ℹ️ INFO
        // =================================================

        if (sub === "info") {

            const id =
                interaction.options.getString(
                    "id"
                );


            const file =
                path.join(

                    backupFolder,

                    `${id}.json`

                );


            if (
                !fs.existsSync(
                    file
                )
            ) {

                return interaction.reply({

                    embeds: [

                        errorEmbed(

                            "Không tìm thấy",

                            `Backup \`${id}\` không tồn tại.`

                        )

                    ],

                    ephemeral: true

                });

            }


            try {

                const backup =
                    JSON.parse(

                        fs.readFileSync(

                            file,

                            "utf8"

                        )

                    );


                return interaction.reply({

                    embeds: [

                        infoEmbed(

                            "📦 Backup Info",

                            `
🆔 **ID**
\`${backup.id}\`

🏠 **Server**
${backup.guild?.name || "Unknown"}

🎭 **Roles**
${backup.roles?.length || 0}

💬 **Channels**
${backup.channels?.length || 0}

😀 **Emojis**
${backup.emojis?.length || 0}

🏷 **Stickers**
${backup.stickers?.length || 0}

📅 **Created**
${backup.createdAt || "Unknown"}
`

                        )

                    ]

                });

            }
            catch (error) {

                return interaction.reply({

                    embeds: [

                        errorEmbed(

                            "Lỗi đọc backup",

                            error.message

                        )

                    ],

                    ephemeral: true

                });

            }

        }


        // =================================================
        // 🗑️ DELETE
        // =================================================

        if (sub === "delete") {

            const id =
                interaction.options.getString(
                    "id"
                );


            const file =
                path.join(

                    backupFolder,

                    `${id}.json`

                );


            if (
                !fs.existsSync(
                    file
                )
            ) {

                return interaction.reply({

                    embeds: [

                        errorEmbed(

                            "Không tìm thấy",

                            `Backup \`${id}\` không tồn tại.`

                        )

                    ],

                    ephemeral: true

                });

            }


            try {

                fs.unlinkSync(
                    file
                );


                return interaction.reply({

                    embeds: [

                        successEmbed(

                            "Backup Deleted",

                            `
🗑️ Đã xóa backup:

\`${id}\`
`

                        )

                    ]

                });

            }
            catch (error) {

                return interaction.reply({

                    embeds: [

                        errorEmbed(

                            "Delete Failed",

                            error.message

                        )

                    ],

                    ephemeral: true

                });

            }

        }


        // =================================================
        // UNKNOWN
        // =================================================

        return interaction.reply({

            content:
                "❌ Không xác định được lệnh backup.",

            ephemeral: true

        });

    }

};