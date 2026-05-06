module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`🚀 ${client.user.tag} online!`);
    client.user.setActivity('TradeFlix • Tickets', { type: 3 }); // Watching
  },
};
