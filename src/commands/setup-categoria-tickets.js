const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-categoria-tickets')
    .setDescription('Define a categoria onde os tickets de atendimento serão criados.')
    .addChannelOption(o => o.setName('categoria').setDescription('Categoria').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const cat = interaction.options.getChannel('categoria');
    const data = db.read();
    data.config.categoriaTicketsId = cat.id;
    db.write(data);
    return interaction.reply({ content: `✅ Categoria de tickets definida: **${cat.name}**`, ephemeral: true });
  }
};
