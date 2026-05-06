const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-log-tickets')
    .setDescription('Define o canal de log geral de tickets (transcripts e fechamentos).')
    .addChannelOption(opt =>
      opt.setName('canal')
        .setDescription('Canal onde os logs de ticket serão postados')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const data = db.read();
    data.config.canalLogTickets = canal.id;
    db.write(data);

    await interaction.reply({
      content: `✅ Canal de log de tickets definido: ${canal}`,
      ephemeral: true,
    });
  },
};
