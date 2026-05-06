const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-cargos-staff')
    .setDescription('Gerencia múltiplos cargos de staff (adicionar, remover, listar).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('adicionar').setDescription('Adiciona um cargo de staff.')
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo a adicionar').setRequired(true)))
    .addSubcommand(s => s.setName('remover').setDescription('Remove um cargo de staff.')
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo a remover').setRequired(true)))
    .addSubcommand(s => s.setName('listar').setDescription('Lista todos os cargos de staff.'))
    .addSubcommand(s => s.setName('limpar').setDescription('Remove todos os cargos de staff.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const data = db.read();
    if (!Array.isArray(data.config.cargoStaffIds)) data.config.cargoStaffIds = [];

    // Migração: se existir cargoStaffId antigo, mover para o array
    if (data.config.cargoStaffId && !data.config.cargoStaffIds.includes(data.config.cargoStaffId)) {
      data.config.cargoStaffIds.push(data.config.cargoStaffId);
    }

    if (sub === 'adicionar') {
      const cargo = interaction.options.getRole('cargo');
      if (data.config.cargoStaffIds.includes(cargo.id)) {
        return interaction.reply({ content: `⚠️ ${cargo} já está cadastrado.`, ephemeral: true });
      }
      data.config.cargoStaffIds.push(cargo.id);
      data.config.cargoStaffId = cargo.id; // mantém compat
      db.write(data);
      return interaction.reply({ content: `✅ ${cargo} adicionado como staff.`, ephemeral: true });
    }

    if (sub === 'remover') {
      const cargo = interaction.options.getRole('cargo');
      data.config.cargoStaffIds = data.config.cargoStaffIds.filter(id => id !== cargo.id);
      if (data.config.cargoStaffId === cargo.id) data.config.cargoStaffId = data.config.cargoStaffIds[0] || null;
      db.write(data);
      return interaction.reply({ content: `🗑️ ${cargo} removido.`, ephemeral: true });
    }

    if (sub === 'listar') {
      const ids = data.config.cargoStaffIds;
      if (!ids.length) return interaction.reply({ content: 'ℹ️ Nenhum cargo de staff cadastrado. Use `/setup-cargos-staff adicionar`.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(config.cor)
        .setTitle('👮 Cargos de Staff TradeFlix')
        .setDescription(ids.map((id, i) => `\`${i + 1}.\` <@&${id}>`).join('\n'))
        .setFooter({ text: `Total: ${ids.length}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'limpar') {
      data.config.cargoStaffIds = [];
      data.config.cargoStaffId = null;
      db.write(data);
      return interaction.reply({ content: '🧹 Todos os cargos de staff foram removidos.', ephemeral: true });
    }
  }
};
