// backend/validator.js

// type permitido
const TYPES = new Set(["confirmed", "death", "recovered"]);

function isValidDateISO(s) {
  // YYYY-MM-DD estricta
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  // Comprobar que no "ruede" de mes/día
  return d instanceof Date && !isNaN(d) && s === d.toISOString().slice(0, 10);
}

function isValidRecord(rec, opts = {}) {
  const { skipCases = false } = opts;

  if (!rec || typeof rec !== "object") return { ok: false, error: "Registro vacío" };

  if (!rec.country || typeof rec.country !== "string" || rec.country.trim().length === 0) {
    return { ok: false, error: "country es requerido" };
  }

  if (!rec.date || typeof rec.date !== "string" || !isValidDateISO(rec.date)) {
    return { ok: false, error: "date inválido (YYYY-MM-DD)" };
  }

  if (!rec.type || typeof rec.type !== "string" || !TYPES.has(rec.type.toLowerCase())) {
    return { ok: false, error: "type debe ser confirmed|death|recovered" };
  }

  if (!skipCases) {
    if (!Number.isInteger(rec.cases) || rec.cases < 0) {
      return { ok: false, error: "cases debe ser entero ≥ 0" };
    }
  }

  return { ok: true };
}

function buildKey({ country, date, type }) {
  return `${country.toLowerCase()}|${date}|${type.toLowerCase()}`;
}

module.exports = { isValidRecord, buildKey, TYPES, isValidDateISO };
