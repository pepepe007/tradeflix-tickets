const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRanking } = require('../utils/stats');
const config = require('../../config.json');

function fmt(v) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }
const medals = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Ranking de movimentação na TradeFlix.')
    .addStringOption(o => o.setName('tipo').setDescription('Geral ou Mensal').setRequired(false)
      .addChoices({ name: 'Geral (Total)', value: 'total' }, { name: 'Mensal', value: 'mensal' })),

  async execute(interaction) {
    await interaction.deferReply();
    const tipo = interaction.options.getString('tipo') || 'total';
    const ranking = getRanking(tipo, 10);
    if (!ranking.length) return interaction.editReply({ content: 'ℹ️ Ainda não há movimentações registradas.' });

    const linhas = ranking.map(r => {
      const medal = medals[r.pos - 1] || `\`${r.pos}.\``;
      return `${medal} <@${r.userId}> — **${fmt(r[tipo])}** (${r.qtd} mm)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.cor)
      .setAuthor({ name: `${config.nomeLoja} • Ranking`, iconURL: config.logo })
      .setTitle(`🏆 Ranking ${tipo === 'mensal' ? 'Mensal' : 'Geral'} TradeFlix`)
      .setDescription(linhas)
      .setThumbnail(config.logo)
      .setFooter({ text: `${config.nomeLoja} • Top 10` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
