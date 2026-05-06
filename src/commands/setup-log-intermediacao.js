const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-log-intermediacao')
    .setDescription('Define o canal de log de intermediações concluídas.')
    .addChannelOption(opt =>
      opt.setName('canal')
        .setDescription('Canal onde os logs serão postados')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const data = db.read();
    data.config.canalLogIntermediacao = canal.id;
    db.write(data);

    await interaction.reply({
      content: `✅ Canal de log de intermediação definido: ${canal}`,
      ephemeral: true,
    });
  },
};
