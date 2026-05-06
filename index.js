const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config.json');
const loadCommands = require('./src/handlers/loadCommands');
const loadEvents = require('./src/handlers/loadEvents');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

(async () => {
  await loadCommands(client);
  loadEvents(client);
  client.login(config.token);
})();

process.on('unhandledRejection', e => console.error('UnhandledRejection:', e?.message || e));
process.on('uncaughtException', e => console.error('UncaughtException:', e?.message || e));
