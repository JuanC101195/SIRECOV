// backend/storage.js
const fs = require("fs/promises");
const path = require("path");
const { buildKey } = require("./validator");

const DATA_PATH = path.resolve(__dirname, "..", "data", "covid_records.txt");
const HEADER = "country,date,type,cases\n";

// Convierte objeto -> línea CSV
function toCSV({ country, date, type, cases }) {
  // NOTA: si country pudiera tener comas, se debería entrecomillar/escapar.
  return `${country},${date},${type},${cases}`;
}

// Convierte línea CSV -> objeto  (devuelve null si está mal o si es la cabecera)
function fromCSV(line) {
  const raw = line.trim();
  if (!raw || raw.toLowerCase() === "country,date,type,cases") return null;
  const parts = raw.split(",");
  if (parts.length !== 4) return null;
  const [country, date, type, casesStr] = parts;
  const n = Number(casesStr);
  if (!Number.isInteger(n) || n < 0) return null;
  return { country, date, type, cases: n };
}

async function ensureFileWithHeader() {
  try {
    const txt = await fs.readFile(DATA_PATH, "utf8");
    if (!txt.startsWith("country,date,type,cases")) {
      await fs.writeFile(DATA_PATH, HEADER + txt, "utf8");
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, HEADER, "utf8");
    } else {
      throw e;
    }
  }
}

async function readAllCSV() {
  await ensureFileWithHeader();
  const txt = await fs.readFile(DATA_PATH, "utf8");
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(fromCSV)
    .filter(Boolean);
}

async function appendRecordCSV(record) {
  await ensureFileWithHeader();
  const line = toCSV(record) + "\n";
  await fs.appendFile(DATA_PATH, line, "utf8");
}

async function existsKeyCSV(key) {
  const all = await readAllCSV();
  return all.some((r) => buildKey(r) === key);
}

async function findByKeyCSV(key) {
  const all = await readAllCSV();
  return all.find((r) => buildKey(r) === key) || null;
}

module.exports = {
  appendRecordCSV,
  existsKeyCSV,
  findByKeyCSV,
  readAllCSV,
  ensureFileWithHeader,
  DATA_PATH,
};
