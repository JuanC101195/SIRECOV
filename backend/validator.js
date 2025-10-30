// backend/validator.js
const TYPES = new Set(["confirmed", "death", "recovered"]);

function isValidDateISO(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return d instanceof Date && !isNaN(d) && s === d.toISOString().slice(0, 10);
}

function isValidRecord(rec, opts = {}) {
  const { skipCases = false } = opts;
  if (!rec || typeof rec !== "object") return { ok: false, error: "payload inválido" };

  if (!rec.country || rec.country.trim() === "")
    return { ok: false, error: "country es requerido" };

  if (!rec.date || !isValidDateISO(rec.date))
    return { ok: false, error: "date debe tener formato YYYY-MM-DD" };

  if (!rec.type || !TYPES.has(rec.type.toLowerCase()))
    return { ok: false, error: "type debe ser confirmed|death|recovered" };

  if (!skipCases) {
    if (!Number.isInteger(rec.cases) || rec.cases < 0)
      return { ok: false, error: "cases debe ser entero ≥ 0" };
  }

  return { ok: true };
}

function buildKey({ country, date, type }) {
  return `${country.toLowerCase()}|${date}|${type.toLowerCase()}`;
}

module.exports = { isValidRecord, buildKey };
