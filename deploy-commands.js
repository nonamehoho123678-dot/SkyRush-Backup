require("dotenv").config();

const { REST, Routes } = require("discord.js");

const fs = require("fs");

const path = require("path");

const commands = [];

const folders = fs.readdirSync("./commands");

for (const folder of folders) {

    const files = fs.readdirSync(`./commands/${folder}`).filter(f => f.endsWith(".js"));

    for (const file of files) {

        const command = require(path.join(__dirname, "commands", folder, file));

        commands.push(command.data.toJSON());

    }

}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {

    console.log("Deploying...");

    await rest.put(

        Routes.applicationCommands(process.env.CLIENT_ID),

        {

            body: commands

        }

    );

    console.log("Done");

})();