const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-cargo-staff')
    .setDescription('Define o cargo da staff que terá acesso aos tickets.')
    .addRoleOption(opt =>
      opt.setName('cargo')
        .setDescription('Cargo da staff')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const cargo = interaction.options.getRole('cargo');
    const data = db.read();
    data.config.cargoStaffId = cargo.id;
    db.write(data);

    await interaction.reply({
      content: `✅ Cargo de staff definido: ${cargo}`,
      ephemeral: true,
    });
  },
};
