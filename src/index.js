const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config.json');
const { handle, handleModal } = require('./handlers/panelHandler');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) client.commands.set(command.data.name, command);
  }
}

client.once('clientReady', readyClient => console.log(`✅ ${readyClient.user.tag} is online!`));

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, client);
      return;
    }
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      await handle(interaction);
      return;
    }
    if (interaction.isModalSubmit()) await handleModal(interaction);
  } catch (error) {
    console.error(error);
    const message = { content: '❌ Đã xảy ra lỗi khi thực hiện thao tác.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(message);
    else await interaction.reply(message);
  }
});

client.login(config.token);
