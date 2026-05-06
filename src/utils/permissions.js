const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');

/**
 * Verifica se um membro é staff (admin ou possui qualquer cargo cadastrado).
 * Retrocompatível: aceita cargoStaffId (string) ou cargoStaffIds (array).
 */
function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const data = db.read();
  const cfg = data.config || {};
  const ids = [];
  if (Array.isArray(cfg.cargoStaffIds)) ids.push(...cfg.cargoStaffIds);
  if (cfg.cargoStaffId) ids.push(cfg.cargoStaffId);
  return ids.some(id => member.roles.cache.has(id));
}

function getStaffRoleIds() {
  const data = db.read();
  const cfg = data.config || {};
  const ids = new Set();
  if (Array.isArray(cfg.cargoStaffIds)) cfg.cargoStaffIds.forEach(i => ids.add(i));
  if (cfg.cargoStaffId) ids.add(cfg.cargoStaffId);
  return [...ids];
}

module.exports = { isStaff, getStaffRoleIds };
