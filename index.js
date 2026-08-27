require("dotenv").config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes,
    ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");


// ========================================================
// ⚙️ ENV
// ========================================================

const TOKEN =
    process.env.DISCORD_TOKEN ||
    process.env.TOKEN;

const CLIENT_ID =
    process.env.CLIENT_ID ||
    process.env.CLIENTID;

const GUILD_ID =
    process.env.GUILD_ID ||
    process.env.GUILDID;


// ========================================================
// 🔐 CHECK ENV
// ========================================================

if (!TOKEN) {

    console.error(
        "❌ Thiếu DISCORD_TOKEN hoặc TOKEN trong file .env"
    );

    process.exit(1);
}

if (!CLIENT_ID) {

    console.error(
        "❌ Thiếu CLIENT_ID trong file .env"
    );

    process.exit(1);
}


// ========================================================
// 🤖 CLIENT
// ========================================================

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMembers,

        GatewayIntentBits.GuildEmojisAndStickers

    ]

});


// ========================================================
// 📦 COMMAND COLLECTION
// ========================================================

client.commands = new Collection();


// ========================================================
// 📋 COMMAND JSON
// ========================================================

const commands = [];


// ========================================================
// 🧹 RESET COMMANDS
// ========================================================

function resetCommands() {

    client.commands.clear();

    commands.length = 0;

}


// ========================================================
// 📂 LOAD COMMANDS
// ========================================================

function loadCommands(directory) {

    if (!fs.existsSync(directory)) {

        console.error(
            `❌ Không tìm thấy thư mục commands: ${directory}`
        );

        return;

    }


    const entries =
        fs.readdirSync(
            directory,
            {
                withFileTypes: true
            }
        );


    for (const entry of entries) {

        const filePath =
            path.join(
                directory,
                entry.name
            );


        // ==================================================
        // 📁 FOLDER
        // ==================================================

        if (entry.isDirectory()) {

            loadCommands(filePath);

            continue;

        }


        // ==================================================
        // 📄 CHỈ JS
        // ==================================================

        if (
            !entry.name.endsWith(".js")
        ) {

            continue;

        }


        // ==================================================
        // 🚫 BỎ QUA FILE PHỤ
        // ==================================================

        const lowerName =
            entry.name.toLowerCase();


        if (
            lowerName === "index.js"
        ) {

            continue;

        }


        // ==================================================
        // 📥 REQUIRE
        // ==================================================

        let command;

        try {

            const resolved =
                require.resolve(filePath);

            delete require.cache[resolved];

            command =
                require(filePath);

        }
        catch (error) {

            console.error("");
            console.error(
                "========================================"
            );

            console.error(
                `❌ LOAD COMMAND ERROR`
            );

            console.error(
                `📁 ${filePath}`
            );

            console.error(
                error
            );

            console.error(
                "========================================"
            );

            continue;

        }


        // ==================================================
        // 🛡️ CHECK COMMAND
        // ==================================================

        if (!command) {

            console.warn(
                `⚠️ Command rỗng: ${filePath}`
            );

            continue;

        }


        if (
            !command.data
        ) {

            console.warn(
                `⚠️ Bỏ qua file không có data: ${filePath}`
            );

            continue;

        }


        if (
            typeof command.data.name !== "string"
        ) {

            console.warn(
                `⚠️ Command không có data.name: ${filePath}`
            );

            continue;

        }


        if (
            typeof command.execute !== "function"
        ) {

            console.warn(
                `⚠️ Command không có execute(): ${filePath}`
            );

            continue;

        }


        // ==================================================
        // 🚫 COMMAND TRÙNG
        // ==================================================

        if (
            client.commands.has(
                command.data.name
            )
        ) {

            console.warn(
                `⚠️ Command trùng: /${command.data.name}`
            );

            continue;

        }


        // ==================================================
        // 💾 SAVE
        // ==================================================

        client.commands.set(

            command.data.name,

            command

        );


        commands.push(
            command.data.toJSON()
        );


        console.log(
            `✅ Loaded command: /${command.data.name}`
        );

    }

}


// ========================================================
// 🚀 LOAD COMMANDS
// ========================================================

console.log("");
console.log(
    "========================================"
);

console.log(
    "📂 LOADING COMMANDS..."
);

console.log(
    "========================================"
);


resetCommands();


loadCommands(
    path.join(
        __dirname,
        "commands"
    )
);


console.log("");
console.log(
    "========================================"
);

console.log(
    `📦 Tổng command đã load: ${client.commands.size}`
);

console.log(
    `📡 Tổng command chuẩn bị đăng ký: ${commands.length}`
);

console.log(
    "========================================"
);


// ========================================================
// 🔎 KIỂM TRA BACKUP
// ========================================================

if (
    client.commands.has("backup")
) {

    console.log(
        "✅ /backup ĐÃ ĐƯỢC LOAD"
    );

}
else {

    console.error(
        "❌ /backup KHÔNG ĐƯỢC LOAD!"
    );

}


// ========================================================
// 🌐 REST
// ========================================================

const rest =
    new REST({
        version: "10"
    }).setToken(
        TOKEN
    );


// ========================================================
// 📡 REGISTER SLASH COMMANDS
// ========================================================

async function registerCommands() {

    try {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "📡 ĐĂNG KÝ SLASH COMMANDS"
        );

        console.log(
            "========================================"
        );


        // ==================================================
        // 🏠 GUILD
        // ==================================================

        if (GUILD_ID) {

            console.log(
                `🏠 Guild ID: ${GUILD_ID}`
            );


            await rest.put(

                Routes.applicationGuildCommands(

                    CLIENT_ID,

                    GUILD_ID

                ),

                {
                    body: commands
                }

            );


            console.log(
                `✅ Đã đăng ký ${commands.length} command cho server.`
            );

        }


        // ==================================================
        // 🌍 GLOBAL
        // ==================================================

        else {

            console.log(
                "🌍 Đăng ký Global Commands..."
            );


            await rest.put(

                Routes.applicationCommands(

                    CLIENT_ID

                ),

                {
                    body: commands
                }

            );


            console.log(
                `✅ Đã đăng ký ${commands.length} global command.`
            );

        }


        // ==================================================
        // 🔎 CHECK BACKUP
        // ==================================================

        if (
            commands.some(
                command =>
                    command.name === "backup"
            )
        ) {

            console.log(
                "✅ Discord đã nhận /backup"
            );

        }
        else {

            console.error(
                "❌ /backup không nằm trong danh sách đăng ký!"
            );

        }


        console.log(
            "========================================"
        );

    }
    catch (error) {

        console.error("");
        console.error(
            "========================================"
        );

        console.error(
            "❌ REGISTER COMMAND ERROR"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );

    }

}


// ========================================================
// 🟢 READY
// ========================================================

let started = false;


async function onReady() {

    // Không chạy 2 lần
    if (started) {

        return;

    }

    started = true;


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🚀 SKYRUSH BACKUP ONLINE"
    );

    console.log(
        `🤖 Bot: ${client.user.tag}`
    );

    console.log(
        `🆔 ID: ${client.user.id}`
    );

    console.log(
        `📦 Commands: ${client.commands.size}`
    );

    console.log(
        "========================================"
    );


    // ==================================================
    // 🎮 STATUS
    // ==================================================

    try {

        client.user.setPresence({

            activities: [

                {

                    name:
                        "SkyRush Backup",

                    type:
                        ActivityType.Watching

                }

            ],

            status:
                "online"

        });

    }
    catch (error) {

        console.log(
            "⚠️ Không set được status:",
            error.message
        );

    }


    // ==================================================
    // 📡 REGISTER
    // ==================================================

    await registerCommands();


    // ==================================================
    // ⏰ AUTO BACKUP
    // ==================================================

    startAutoBackup();

}


// ========================================================
// 🟢 CLIENT READY
// ========================================================

client.once(
    "clientReady",
    onReady
);


// ========================================================
// 💬 INTERACTION
// ========================================================

client.on(
    "interactionCreate",
    async interaction => {


        // ==================================================
        // / COMMAND
        // ==================================================

        if (
            interaction.isChatInputCommand()
        ) {

            const command =
                client.commands.get(
                    interaction.commandName
                );


            // =================================================
            // ❌ KHÔNG TÌM THẤY
            // =================================================

            if (!command) {

                console.warn(
                    `⚠️ Không tìm thấy command: /${interaction.commandName}`
                );


                try {

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {

                        await interaction.editReply({

                            content:
                                "❌ Command không tồn tại.",

                            embeds: [],

                            components: []

                        });

                    }
                    else {

                        await interaction.reply({

                            content:
                                "❌ Command không tồn tại.",

                            ephemeral:
                                true

                        });

                    }

                }
                catch {}

                return;

            }


            // =================================================
            // ▶️ EXECUTE
            // =================================================

            try {

                await command.execute(
                    interaction
                );

            }
            catch (error) {

                console.error("");
                console.error(
                    "========================================"
                );

                console.error(
                    `❌ ERROR /${interaction.commandName}`
                );

                console.error(
                    error
                );

                console.error(
                    "========================================"
                );


                try {

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {

                        await interaction.editReply({

                            content:
                                "❌ Đã xảy ra lỗi khi thực hiện command.",

                            embeds: [],

                            components: []

                        });

                    }
                    else {

                        await interaction.reply({

                            content:
                                "❌ Đã xảy ra lỗi khi thực hiện command.",

                            ephemeral:
                                true

                        });

                    }

                }
                catch (replyError) {

                    console.error(
                        "❌ Không thể gửi lỗi Discord:",
                        replyError.message
                    );

                }

            }

            return;

        }


        // ==================================================
        // 🔘 BUTTON
        // ==================================================

        if (
            interaction.isButton()
        ) {

            try {

                const buttonPath =
                    path.join(

                        __dirname,

                        "components",

                        "buttons",

                        `${interaction.customId}.js`

                    );


                if (
                    !fs.existsSync(
                        buttonPath
                    )
                ) {

                    console.warn(
                        `⚠️ Không tìm thấy button: ${interaction.customId}`
                    );

                    return;

                }


                const resolved =
                    require.resolve(
                        buttonPath
                    );


                delete require.cache[
                    resolved
                ];


                const button =
                    require(
                        buttonPath
                    );


                if (
                    typeof button.execute ===
                    "function"
                ) {

                    await button.execute(
                        interaction
                    );

                }
                else {

                    console.warn(
                        `⚠️ Button không có execute(): ${interaction.customId}`
                    );

                }

            }
            catch (error) {

                console.error(
                    "❌ BUTTON ERROR:",
                    error
                );

            }

            return;

        }


        // ==================================================
        // 📋 SELECT MENU
        // ==================================================

        if (
            interaction.isStringSelectMenu()
        ) {

            try {

                const menuPath =
                    path.join(

                        __dirname,

                        "components",

                        "menus",

                        `${interaction.customId}.js`

                    );


                if (
                    !fs.existsSync(
                        menuPath
                    )
                ) {

                    console.warn(
                        `⚠️ Không tìm thấy menu: ${interaction.customId}`
                    );

                    return;

                }


                const resolved =
                    require.resolve(
                        menuPath
                    );


                delete require.cache[
                    resolved
                ];


                const menu =
                    require(
                        menuPath
                    );


                if (
                    typeof menu.execute ===
                    "function"
                ) {

                    await menu.execute(
                        interaction
                    );

                }
                else {

                    console.warn(
                        `⚠️ Menu không có execute(): ${interaction.customId}`
                    );

                }

            }
            catch (error) {

                console.error(
                    "❌ SELECT MENU ERROR:",
                    error
                );

            }

            return;

        }


        // ==================================================
        // 📝 MODAL
        // ==================================================

        if (
            interaction.isModalSubmit()
        ) {

            try {

                const modalPath =
                    path.join(

                        __dirname,

                        "components",

                        "modals",

                        `${interaction.customId}.js`

                    );


                if (
                    !fs.existsSync(
                        modalPath
                    )
                ) {

                    console.warn(
                        `⚠️ Không tìm thấy modal: ${interaction.customId}`
                    );

                    return;

                }


                const resolved =
                    require.resolve(
                        modalPath
                    );


                delete require.cache[
                    resolved
                ];


                const modal =
                    require(
                        modalPath
                    );


                if (
                    typeof modal.execute ===
                    "function"
                ) {

                    await modal.execute(
                        interaction
                    );

                }
                else {

                    console.warn(
                        `⚠️ Modal không có execute(): ${interaction.customId}`
                    );

                }

            }
            catch (error) {

                console.error(
                    "❌ MODAL ERROR:",
                    error
                );

            }

        }

    }
);


// ========================================================
// ⏰ AUTO BACKUP
// ========================================================

function startAutoBackup() {

    const schedulerPath =
        path.join(

            __dirname,

            "utils",

            "autoBackup",

            "scheduler.js"

        );


    if (
        !fs.existsSync(
            schedulerPath
        )
    ) {

        console.log(
            "⚠️ Không tìm thấy utils/autoBackup/scheduler.js"
        );

        return;

    }


    try {

        const resolved =
            require.resolve(
                schedulerPath
            );


        delete require.cache[
            resolved
        ];


        const scheduler =
            require(
                schedulerPath
            );


        // ==================================================
        // FUNCTION
        // ==================================================

        if (
            typeof scheduler ===
            "function"
        ) {

            scheduler(
                client
            );

        }


        // ==================================================
        // .start()
        // ==================================================

        else if (
            typeof scheduler.start ===
            "function"
        ) {

            scheduler.start(
                client
            );

        }


        // ==================================================
        // .init()
        // ==================================================

        else if (
            typeof scheduler.init ===
            "function"
        ) {

            scheduler.init(
                client
            );

        }


        else {

            console.warn(
                "⚠️ scheduler.js không có function."
            );

            return;

        }


        console.log(
            "⏰ Auto Backup đã khởi động."
        );

    }
    catch (error) {

        console.error(
            "❌ AUTO BACKUP ERROR:"
        );

        console.error(
            error
        );

    }

}


// ========================================================
// ❌ UNHANDLED REJECTION
// ========================================================

process.on(
    "unhandledRejection",
    error => {

        console.error("");
        console.error(
            "❌ UNHANDLED REJECTION:"
        );

        console.error(
            error
        );

    }
);


// ========================================================
// ❌ UNCAUGHT EXCEPTION
// ========================================================

process.on(
    "uncaughtException",
    error => {

        console.error("");
        console.error(
            "❌ UNCAUGHT EXCEPTION:"
        );

        console.error(
            error
        );

    }
);


// ========================================================
// 🔐 LOGIN
// ========================================================

console.log("");
console.log(
    "🔐 Đang đăng nhập Discord..."
);


client.login(
    TOKEN
);