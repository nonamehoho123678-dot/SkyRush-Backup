const { REST, Routes } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config.json');

async function registerCommands() {
  const commands = [];
  const dir = path.join(__dirname);
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'register.js')) {
    const command = require(path.join(dir, file));
    if (command.data) commands.push(command.data.toJSON());
  }
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log(`✅ Registered ${commands.length} slash command(s).`);
}

if (require.main === module) registerCommands().catch(console.error);
module.exports = { registerCommands };
