// backend/storage.js
const fs = require("fs/promises");
const path = require("path");
const { buildKey } = require("./validator");

const DATA_PATH = path.resolve(__dirname, "..", "data", "covid_records.txt");
const HEADER = "country,date,type,cases\n";

function toCSV({ country, date, type, cases }) {
  return `${country},${date},${type},${cases}`;
}

function fromCSV(line) {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed === "country,date,type,cases") return null;
  const parts = trimmed.split(",");
  if (parts.length !== 4) return null;
  const [country, date, type, casesRaw] = parts;
  const cases = Number(casesRaw);
  if (!Number.isFinite(cases)) return null;
  return { country, date, type, cases };
}

async function ensureFileWithHeader() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, HEADER, "utf8");
  }
}

async function appendRecordCSV(rec) {
  await fs.appendFile(DATA_PATH, toCSV(rec) + "\n", "utf8");
}

async function readAllCSV() {
  await ensureFileWithHeader();
  const data = await fs.readFile(DATA_PATH, "utf8");
  const lines = data.split(/\r?\n/);
  const out = [];
  for (const ln of lines) {
    const r = fromCSV(ln);
    if (r) out.push(r);
  }
  return out;
}

async function existsKeyCSV(key) {
  const all = await readAllCSV();
  return all.some(r => buildKey(r) === key);
}

async function findByKeyCSV(key) {
  const all = await readAllCSV();
  return all.find(r => buildKey(r) === key) || null;
}

module.exports = {
  appendRecordCSV,
  findByKeyCSV,
  existsKeyCSV,
  readAllCSV,
  ensureFileWithHeader,
  DATA_PATH,
};
