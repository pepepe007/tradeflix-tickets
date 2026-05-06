const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-cargo-tier')
    .setDescription('Cargos por movimentação total (níveis VIP).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('adicionar').setDescription('Adiciona/atualiza um cargo de nível.')
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo a atribuir').setRequired(true))
      .addNumberOption(o => o.setName('valor-minimo').setDescription('Valor mínimo movimentado em R$').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('remover').setDescription('Remove um cargo de nível.')
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo').setRequired(true)))
    .addSubcommand(s => s.setName('listar').setDescription('Lista os tiers configurados.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const data = db.read();
    if (!Array.isArray(data.config.cargosPorMovimentacao)) data.config.cargosPorMovimentacao = [];

    if (sub === 'adicionar') {
      const cargo = interaction.options.getRole('cargo');
      const valor = interaction.options.getNumber('valor-minimo');
      data.config.cargosPorMovimentacao = data.config.cargosPorMovimentacao.filter(t => t.cargoId !== cargo.id);
      data.config.cargosPorMovimentacao.push({ cargoId: cargo.id, valorMinimo: valor });
      data.config.cargosPorMovimentacao.sort((a, b) => a.valorMinimo - b.valorMinimo);
      db.write(data);
      return interaction.reply({ content: `✅ Tier configurado: ${cargo} a partir de **R$ ${valor.toFixed(2)}**`, ephemeral: true });
    }

    if (sub === 'remover') {
      const cargo = interaction.options.getRole('cargo');
      data.config.cargosPorMovimentacao = data.config.cargosPorMovimentacao.filter(t => t.cargoId !== cargo.id);
      db.write(data);
      return interaction.reply({ content: `🗑️ Tier de ${cargo} removido.`, ephemeral: true });
    }

    if (sub === 'listar') {
      const tiers = data.config.cargosPorMovimentacao;
      if (!tiers.length) return interaction.reply({ content: 'ℹ️ Nenhum tier configurado.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(config.cor)
        .setTitle('🏆 Tiers TradeFlix por Movimentação')
        .setDescription(tiers.map((t, i) => `\`${i + 1}.\` <@&${t.cargoId}> — a partir de **R$ ${t.valorMinimo.toFixed(2)}**`).join('\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
