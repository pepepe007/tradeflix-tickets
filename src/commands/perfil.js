const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const config = require('../../config.json');
const { getSaldo, getTierAtual, getProximoTier, TIERS, fmt, parseValor } = require('../utils/tiersCliente');

// IDs fixos por requisito
const CANAL_PERFIL_PERMITIDO = '1499219831084552304';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Veja seu perfil de cliente na TradeFlix'),

  async execute(interaction) {
    // 1) Restrição de canal
    if (interaction.channelId !== CANAL_PERFIL_PERMITIDO) {
      return interaction.reply({
        content: `❌ O comando \`/perfil\` só pode ser usado em <#${CANAL_PERFIL_PERMITIDO}>.`,
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const user = interaction.user;
    const data = db.read();

    // ===== 2) SALDO TOTAL (fonte de verdade: saldoClientes) =====
    let saldo = 0;
    try {
      saldo = getSaldo(user.id) ?? 0;
    } catch {
      saldo = data.saldoClientes?.[user.id] || 0;
    }
    if (typeof saldo !== 'number' || isNaN(saldo)) saldo = 0;

    // ===== 3) Middlemans concluídos =====
    const ticketsParticipados = Object.values(data.tickets || {}).filter(t =>
      (t.userId === user.id || t.outroParticipanteId === user.id) && t.intermediacaoRegistrada
    );
    const totalTickets = ticketsParticipados.length;

    // ===== 4) Tier atual e próximo =====
    const tierAtual = getTierAtual(saldo);
    const proximoTier = getProximoTier(saldo);

    const nomeTierAtual = tierAtual?.nome || 'Sem tier ainda';
    const corTier = config.cor;

    // ===== 5) Barra de progresso (CORRIGIDA — usa valorMinimo) =====
    let progressoStr = '';
    if (proximoTier) {
      const base = tierAtual?.valorMinimo || 0;
      const alvo = proximoTier.valorMinimo;
      const intervalo = alvo - base;
      const ganho = saldo - base;
      const faltam = Math.max(0, alvo - saldo);
      const percent = intervalo > 0 ? Math.min(100, Math.max(0, (ganho / intervalo) * 100)) : 0;

      const blocos = Math.round(percent / 10);
      const barra = '🟪'.repeat(blocos) + '⬜'.repeat(10 - blocos);
      progressoStr = `${barra} **${percent.toFixed(1)}%**\nFaltam **${fmt(faltam)}** para **${proximoTier.nome}**`;
    } else {
      progressoStr = '🏆 **Você atingiu o tier máximo!** Obrigado por ser um cliente lendário. 💜';
    }

    // ===== 6) RANKING GERAL (saldo total acumulado) =====
    const rankingGeral = Object.entries(data.saldoClientes || {})
      .map(([uid, valor]) => ({ uid, valor: Number(valor) || 0 }))
      .filter(x => x.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    const posGeral = rankingGeral.findIndex(x => x.uid === user.id);
    const totalClientesGeral = rankingGeral.length;

    // ===== 7) RANKING MENSAL (somatório de vendas no mês corrente) =====
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1).getTime();

    // Acumula gasto mensal por usuário a partir dos tickets de middleman concluídos
    const gastoMensal = {}; // { userId: total }
    for (const t of Object.values(data.tickets || {})) {
      if (!t.intermediacaoRegistrada) continue;
      if (!t.finalizadoEm || t.finalizadoEm < inicioMes || t.finalizadoEm >= fimMes) continue;
      const v = parseValor(t.valor);
      if (!v || v <= 0) continue;
      // Conta o valor para AMBOS participantes (mesmo critério do saldo geral)
      if (t.userId) gastoMensal[t.userId] = (gastoMensal[t.userId] || 0) + v;
      if (t.outroParticipanteId) gastoMensal[t.outroParticipanteId] = (gastoMensal[t.outroParticipanteId] || 0) + v;
    }

    const rankingMensal = Object.entries(gastoMensal)
      .map(([uid, valor]) => ({ uid, valor }))
      .filter(x => x.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    const posMensal = rankingMensal.findIndex(x => x.uid === user.id);
    const totalClientesMes = rankingMensal.length;
    const gastoMesUser = gastoMensal[user.id] || 0;

    const fmtRanking = (pos, total) => {
      if (pos < 0) return '— *(sem registros)*';
      const medalha = pos === 0 ? '🥇' : pos === 1 ? '🥈' : pos === 2 ? '🥉' : '🏅';
      return `${medalha} **#${pos + 1}** de ${total}`;
    };

    const nomeMes = agora.toLocaleString('pt-BR', { month: 'long' });

    // ===== 8) Monta o embed =====
    const embed = new EmbedBuilder()
      .setColor(corTier)
      .setAuthor({ name: `${config.nomeLoja} • Perfil de Cliente`, iconURL: config.logo })
      .setTitle(`👤 ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🏅 Cargo Atual', value: nomeTierAtual, inline: true },
        { name: '💰 Total Gasto', value: `**${fmt(saldo)}**`, inline: true },
        { name: '🤝 Middlemans', value: `**${totalTickets}**`, inline: true },
        { name: '📈 Progresso', value: progressoStr, inline: false },
        { name: '🌍 Ranking Geral', value: fmtRanking(posGeral, totalClientesGeral), inline: true },
        { name: `📅 Ranking ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`, value: fmtRanking(posMensal, totalClientesMes), inline: true },
        { name: '💸 Gasto no mês', value: `**${fmt(gastoMesUser)}**`, inline: true }
      )
      .setFooter({ text: `${config.nomeLoja} • Confiança em primeiro lugar` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
