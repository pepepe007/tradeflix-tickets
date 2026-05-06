const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '..', '..', 'database');
const dbPath = path.join(dbDir, 'db.json');

const defaultDb = {
  config: {
    categoriaId: null,                // categoria dos tickets de middleman
    canalLogIntermediacao: null,      // canal de provas sociais
    canalLogTickets: null,            // canal de logs de fechamento
    cargoStaffId: null,               // legacy (cargo único antigo)
    cargoStaffIds: [],                // múltiplos cargos staff
    categoriaTicketsId: null,         // categoria dos tickets de atendimento
    cargoBuyerId: null,               // cargo de comprador (legacy/simples)
    cargosPorMovimentacao: []         // [{ cargoId, valorMinimo }] (legacy/dinâmico)
  },
  tickets: {},                        // tickets de middleman
  contadorIntermediacao: 0,
  contadorTicket: 0,
  ticketsAtendimento: {},             // tickets de compra/venda/suporte
  contadorTicketAtendimento: 0,
  saldoClientes: {}                   // { userId: valorAcumulado } — usado pelos tiers automáticos
};

function ensureDb() {
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    console.log('🗄️  db.json criado do zero.');
  }
}

function mergeDeep(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      out[key] = mergeDeep(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function read() {
  ensureDb();
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    const merged = mergeDeep(defaultDb, parsed);

    // Migração automática: legacy cargoStaffId → array cargoStaffIds
    if (merged.config.cargoStaffId && Array.isArray(merged.config.cargoStaffIds)) {
      if (!merged.config.cargoStaffIds.includes(merged.config.cargoStaffId)) {
        merged.config.cargoStaffIds.push(merged.config.cargoStaffId);
      }
    }

    // Garante que saldoClientes exista mesmo em DBs antigos
    if (!merged.saldoClientes || typeof merged.saldoClientes !== 'object') {
      merged.saldoClientes = {};
    }

    return merged;
  } catch (err) {
    console.error('⚠️  db.json corrompido, restaurando padrão. Backup salvo em db.backup.<timestamp>.json');
    try {
      fs.copyFileSync(dbPath, path.join(dbDir, `db.backup.${Date.now()}.json`));
    } catch {}
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return JSON.parse(JSON.stringify(defaultDb));
  }
}

function write(data) {
  ensureDb();
  const tmp = dbPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dbPath);
}

module.exports = { read, write };
