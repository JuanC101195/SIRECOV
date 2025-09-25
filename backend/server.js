// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { isValidRecord, buildKey } = require("./validator");
const { appendRecordCSV, findByKeyCSV, existsKeyCSV, ensureFileWithHeader, DATA_PATH } = require("./storage");

const app = express();
app.use(cors());
app.use(express.json());

// Servir frontend estático
const FRONT_DIR = path.resolve(__dirname, "..", "frontend");
app.use(express.static(FRONT_DIR));

// Ping
app.get("/health", async (_, res) => {
  res.json({ ok: true, dataFile: path.basename(DATA_PATH) });
});

// POST /records  -> guardar registro en .txt (CSV)
app.post("/records", async (req, res) => {
  try {
    let { country, date, type, cases } = req.body ?? {};
    if (typeof country === "string") country = country.trim();
    if (typeof date === "string") date = date.trim();
    if (typeof type === "string") type = type.trim().toLowerCase();
    cases = Number(cases);

    const record = { country, date, type, cases };
    const valid = isValidRecord(record);
    if (!valid.ok) return res.status(400).json({ ok:false, error: valid.error });

    const key = buildKey(record);
    const already = await existsKeyCSV(key);
    if (already) return res.status(409).json({ ok:false, error: "La combinación país+fecha+tipo ya existe" });

    await appendRecordCSV(record);
    res.status(201).json({ ok:true, message: "Registro guardado", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: "Error del servidor" });
  }
});

// GET /records?country=&date=&type=  -> consulta por clave única
app.get("/records", async (req, res) => {
  try {
    let { country, date, type } = req.query ?? {};
    if (typeof country === "string") country = country.trim();
    if (typeof date === "string") date = date.trim();
    if (typeof type === "string") type = type.trim().toLowerCase();

    const probe = { country, date, type, cases: 0 };
    const valid = isValidRecord(probe, { skipCases: true });
    if (!valid.ok) return res.status(400).json({ ok:false, error: "Parámetros de búsqueda inválidos" });

    const key = buildKey(probe);
    const found = await findByKeyCSV(key);
    if (!found) return res.status(404).json({ ok:false, error: "No encontrado" });

    res.json({ ok:true, record: found });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: "Error del servidor" });
  }
});

// Single Page App fallback (si abren rutas directas)
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONT_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await ensureFileWithHeader();
  console.log(`✅ SIRECOV (friend-plus) en http://localhost:${PORT}`);
});
