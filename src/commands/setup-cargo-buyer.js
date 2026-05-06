const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-cargo-buyer')
    .setDescription('Define o cargo Buyer atribuído após venda concluída.')
    .addRoleOption(o => o.setName('cargo').setDescription('Cargo Buyer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const cargo = interaction.options.getRole('cargo');
    const data = db.read();
    data.config.cargoBuyerId = cargo.id;
    db.write(data);
    return interaction.reply({ content: `✅ Cargo Buyer definido: ${cargo}`, ephemeral: true });
  }
};
