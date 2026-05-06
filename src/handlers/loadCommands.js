const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../../config.json');

module.exports = async (client) => {
  const commands = [];
  client.commands = new Map();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('🔄 Registrando slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log(`✅ ${commands.length} comandos registrados.`);
  } catch (err) {
    console.error(err);
  }
};
