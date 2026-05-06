const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'database', 'embeds.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ templates: {}, drafts: {} }, null, 2));
}

function read() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { templates: {}, drafts: {} };
  }
}

function write(data) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Draft = embed em construção (por usuário)
function getDraft(userId) {
  const data = read();
  return data.drafts[userId] || null;
}

function setDraft(userId, draft) {
  const data = read();
  data.drafts[userId] = draft;
  write(data);
}

function clearDraft(userId) {
  const data = read();
  delete data.drafts[userId];
  write(data);
}

// Templates salvos com nome
function saveTemplate(name, embedData) {
  const data = read();
  data.templates[name.toLowerCase()] = embedData;
  write(data);
}

function getTemplate(name) {
  const data = read();
  return data.templates[name.toLowerCase()] || null;
}

function deleteTemplate(name) {
  const data = read();
  const existed = !!data.templates[name.toLowerCase()];
  delete data.templates[name.toLowerCase()];
  write(data);
  return existed;
}

function listTemplates() {
  const data = read();
  return Object.keys(data.templates);
}

module.exports = { read, write, getDraft, setDraft, clearDraft, saveTemplate, getTemplate, deleteTemplate, listTemplates };
