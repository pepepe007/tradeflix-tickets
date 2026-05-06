const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-categoria')
    .setDescription('Define a categoria onde os tickets serão criados.')
    .addChannelOption(opt =>
      opt.setName('categoria')
        .setDescription('Selecione a categoria')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const categoria = interaction.options.getChannel('categoria');
    const data = db.read();
    data.config.categoriaId = categoria.id;
    db.write(data);

    await interaction.reply({
      content: `✅ Categoria de tickets definida: **${categoria.name}**`,
      ephemeral: true,
    });
  },
};
