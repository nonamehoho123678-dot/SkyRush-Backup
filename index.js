require("dotenv").config();

const { Client, Collection, GatewayIntentBits, REST, Routes, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || process.env.CLIENTID;
const GUILD_ID = process.env.GUILD_ID || process.env.GUILDID;

if (!TOKEN) { console.error("❌ Thiếu DISCORD_TOKEN hoặc TOKEN trong file .env"); process.exit(1); }
if (!CLIENT_ID) { console.error("❌ Thiếu CLIENT_ID trong file .env"); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildEmojisAndStickers] });
client.commands = new Collection();
const commands = [];

function loadCommands(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) { loadCommands(filePath); continue; }
        if (!entry.name.endsWith(".js")) continue;
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (!command?.data || typeof command.data.name !== "string" || typeof command.execute !== "function") continue;
            if (client.commands.has(command.data.name)) continue;
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded command: /${command.data.name}`);
        } catch (error) { console.error(`❌ Không thể load command: ${filePath}`, error); }
    }
}

console.log("\n========================================\n📂 LOADING COMMANDS...\n========================================");
loadCommands(path.join(__dirname, "commands"));
console.log(`\n📦 Tổng command đã load: ${client.commands.size}`);
console.log(`📡 Tổng command chuẩn bị đăng ký: ${commands.length}`);
console.log("========================================");

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log("\n========================================\n📡 ĐĂNG KÝ SLASH COMMANDS\n========================================");
        if (GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
            console.log(`🏠 Đã đăng ký ${commands.length} command cho server test.`);
            return;
        }
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`🌍 Đã đăng ký ${commands.length} global command.`);
        for (const guild of client.guilds.cache.values()) {
            try {
                await guild.commands.set(commands);
                console.log(`🧹 Đã đồng bộ command cho: ${guild.name}`);
            } catch (error) { console.error(`❌ Không thể đồng bộ command cho ${guild.name}:`, error.message); }
        }
    } catch (error) { console.error("❌ REGISTER COMMAND ERROR:", error); }
}

function startAutoBackup() {
    const schedulerPath = path.join(__dirname, "utils", "autoBackup", "scheduler.js");
    if (!fs.existsSync(schedulerPath)) return;
    try {
        delete require.cache[require.resolve(schedulerPath)];
        const scheduler = require(schedulerPath);
        if (typeof scheduler === "function") scheduler(client);
        else if (typeof scheduler.start === "function") scheduler.start(client);
        else if (typeof scheduler.init === "function") scheduler.init(client);
        else return console.warn("⚠️ scheduler.js không có function start/init.");
        console.log("⏰ Auto Backup đã khởi động.");
    } catch (error) { console.error("❌ AUTO BACKUP ERROR:", error); }
}

client.once("clientReady", async () => {
    console.log("\n========================================\n🚀 SKYRUSH BACKUP ONLINE");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 ID: ${client.user.id}`);
    console.log(`📦 Commands: ${client.commands.size}`);
    console.log("========================================");
    client.user.setPresence({ activities: [{ name: "SkyRush Backup", type: ActivityType.Watching }], status: "online" });
    await registerCommands();
    startAutoBackup();
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) {
        if (interaction.isButton()) {
            try {
                const buttonPath = path.join(__dirname, "components", "buttons", `${interaction.customId}.js`);
                if (!fs.existsSync(buttonPath)) return;
                delete require.cache[require.resolve(buttonPath)];
                const button = require(buttonPath);
                if (typeof button.execute === "function") await button.execute(interaction);
            } catch (error) {
                console.error("❌ BUTTON ERROR:", error);
                try { if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: "❌ Đã xảy ra lỗi khi xử lý nút.", flags: 64 }); } catch {}
            }
            return;
        }

        if (interaction.isStringSelectMenu()) {
            try {
                let menuFile = `${interaction.customId}.js`;
                if (interaction.customId.startsWith("backup_restore_options_")) menuFile = "backup_restore_options.js";
                const menuPath = path.join(__dirname, "components", "menus", menuFile);
                if (!fs.existsSync(menuPath)) return;
                delete require.cache[require.resolve(menuPath)];
                const menu = require(menuPath);
                if (typeof menu.execute === "function") await menu.execute(interaction);
            } catch (error) {
                console.error("❌ SELECT MENU ERROR:", error);
                try { if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: "❌ Đã xảy ra lỗi khi xử lý menu.", flags: 64 }); } catch {}
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            try {
                const modalPath = path.join(__dirname, "components", "modals", `${interaction.customId}.js`);
                if (!fs.existsSync(modalPath)) return;
                delete require.cache[require.resolve(modalPath)];
                const modal = require(modalPath);
                if (typeof modal.execute === "function") await modal.execute(interaction);
            } catch (error) { console.error("❌ MODAL ERROR:", error); }
        }
        return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        try { if (interaction.replied || interaction.deferred) await interaction.editReply({ content: "❌ Command không tồn tại.", embeds: [], components: [] }); else if (interaction.isRepliable()) await interaction.reply({ content: "❌ Command không tồn tại.", flags: 64 }); } catch {}
        return;
    }

    try { await command.execute(interaction); }
    catch (error) {
        console.error(`❌ ERROR /${interaction.commandName}`, error);
        try { if (interaction.replied || interaction.deferred) await interaction.editReply({ content: "❌ Đã xảy ra lỗi khi thực hiện command.", embeds: [], components: [] }); else if (interaction.isRepliable()) await interaction.reply({ content: "❌ Đã xảy ra lỗi khi thực hiện command.", flags: 64 }); } catch {}
    }
});

process.on("unhandledRejection", error => console.error("\n❌ UNHANDLED REJECTION:", error));
process.on("uncaughtException", error => console.error("\n❌ UNCAUGHT EXCEPTION:", error));

console.log("🔐 Đang đăng nhập Discord...");
client.login(TOKEN);
