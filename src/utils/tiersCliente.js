const db = require('./db');

// Tiers fixos da TradeFlix (ordem crescente)
const TIERS = [
  { cargoId: '1499219143600377976', valorMinimo: 100,    nome: 'Cliente' },
  { cargoId: '1499219190794555392', valorMinimo: 1000,   nome: 'Cliente Mítico' },
  { cargoId: '1499219212416319742', valorMinimo: 5000,   nome: 'Cliente Supremo' },
  { cargoId: '1499219216166031540', valorMinimo: 10000,  nome: 'Cliente Divino' }
];

/**
 * Soma valor ao saldo acumulado do cliente.
 * Retorna o novo total.
 */
function adicionarSaldo(userId, valor) {
  if (!valor || isNaN(valor) || valor <= 0) return getSaldo(userId);
  const data = db.read();
  if (!data.saldoClientes) data.saldoClientes = {};
  data.saldoClientes[userId] = (data.saldoClientes[userId] || 0) + valor;
  db.write(data);
  return data.saldoClientes[userId];
}

function getSaldo(userId) {
  const data = db.read();
  return data.saldoClientes?.[userId] || 0;
}

/**
 * Determina o tier atual baseado no saldo total.
 * Retorna o tier mais alto que o usuário atingiu, ou null se nenhum.
 */
function getTierAtual(saldoTotal) {
  let atingido = null;
  for (const tier of TIERS) {
    if (saldoTotal >= tier.valorMinimo) atingido = tier;
    else break;
  }
  return atingido;
}

function getProximoTier(saldoTotal) {
  for (const tier of TIERS) {
    if (saldoTotal < tier.valorMinimo) return tier;
  }
  return null; // já no tier máximo
}

/**
 * Aplica o cargo correto ao membro e remove os tiers inferiores.
 * Retorna { tierNovo, tierAntigo, subiu } para feedback.
 */
async function aplicarCargoTier(member, saldoTotal) {
  const tierNovo = getTierAtual(saldoTotal);

  // Identifica tier antigo (pelos cargos atuais do membro)
  const cargosAtuaisDoMembro = TIERS.filter(t => member.roles.cache.has(t.cargoId));
  const tierAntigo = cargosAtuaisDoMembro.length
    ? cargosAtuaisDoMembro.reduce((max, t) => (t.valorMinimo > max.valorMinimo ? t : max))
    : null;

  if (!tierNovo) return { tierNovo: null, tierAntigo, subiu: false };

  const subiu = !tierAntigo || tierNovo.valorMinimo > tierAntigo.valorMinimo;

  // Remove todos os cargos de tier que não sejam o novo
  for (const t of TIERS) {
    if (t.cargoId === tierNovo.cargoId) continue;
    if (member.roles.cache.has(t.cargoId)) {
      await member.roles.remove(t.cargoId).catch(() => {});
    }
  }

  // Adiciona o cargo do tier atual (se ainda não tiver)
  if (!member.roles.cache.has(tierNovo.cargoId)) {
    await member.roles.add(tierNovo.cargoId).catch(() => {});
  }

  return { tierNovo, tierAntigo, subiu };
}

/**
 * Parse de valor em string para número.
 * Aceita "R$ 250,00", "250.00", "250,00", "250", etc.
 */
function parseValor(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const limpo = String(str)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3})/g, '')   // remove pontos de milhar
    .replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

function fmt(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

module.exports = { TIERS, adicionarSaldo, getSaldo, getTierAtual, getProximoTier, aplicarCargoTier, parseValor, fmt };
