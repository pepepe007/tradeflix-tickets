const db = require('./db');

/**
 * Calcula estatísticas pessoais e ranking baseado em middlemans concluídos.
 */
function parseValor(str) {
  if (!str) return 0;
  // "R$ 250,00" / "250.00" / "250,00"
  const limpo = String(str).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

function calcularStatsTodos() {
  const data = db.read();
  const tickets = Object.values(data.tickets || {}).filter(t => t.intermediacaoRegistrada);
  const stats = new Map();

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesTs = inicioMes.getTime();

  for (const t of tickets) {
    const valor = parseValor(t.valor);
    const ts = t.criadoEm || 0;
    const ehMensal = ts >= inicioMesTs;

    const ids = [t.userId, t.outroParticipanteId].filter(Boolean);
    for (const uid of ids) {
      if (!stats.has(uid)) stats.set(uid, { total: 0, mensal: 0, qtd: 0, qtdMensal: 0, maior: 0 });
      const s = stats.get(uid);
      s.total += valor;
      s.qtd += 1;
      if (valor > s.maior) s.maior = valor;
      if (ehMensal) {
        s.mensal += valor;
        s.qtdMensal += 1;
      }
    }
  }
  return stats;
}

function getStatsUsuario(userId) {
  const todos = calcularStatsTodos();
  const stats = todos.get(userId) || { total: 0, mensal: 0, qtd: 0, qtdMensal: 0, maior: 0 };

  // Posição geral
  const arrGeral = [...todos.entries()].sort((a, b) => b[1].total - a[1].total);
  const posGeral = arrGeral.findIndex(([id]) => id === userId) + 1 || null;

  // Posição mensal
  const arrMensal = [...todos.entries()].filter(([, s]) => s.mensal > 0).sort((a, b) => b[1].mensal - a[1].mensal);
  const posMensal = arrMensal.findIndex(([id]) => id === userId) + 1 || null;

  return { ...stats, posGeral, posMensal, totalUsuarios: todos.size };
}

function getRanking(tipo = 'total', limit = 10) {
  const todos = calcularStatsTodos();
  const arr = [...todos.entries()]
    .filter(([, s]) => s[tipo] > 0)
    .sort((a, b) => b[1][tipo] - a[1][tipo])
    .slice(0, limit);
  return arr.map(([userId, stats], i) => ({ pos: i + 1, userId, ...stats }));
}

function getCargoAtualEProximo(member, totalMovimentado) {
  const data = db.read();
  const tiers = (data.config.cargosPorMovimentacao || []).slice().sort((a, b) => a.valorMinimo - b.valorMinimo);
  if (!tiers.length) return { atual: null, proximo: null, falta: 0 };

  let atual = null;
  let proximo = null;
  for (const t of tiers) {
    if (totalMovimentado >= t.valorMinimo) atual = t;
    else { proximo = t; break; }
  }
  const falta = proximo ? Math.max(0, proximo.valorMinimo - totalMovimentado) : 0;
  return { atual, proximo, falta };
}

module.exports = { parseValor, calcularStatsTodos, getStatsUsuario, getRanking, getCargoAtualEProximo };
