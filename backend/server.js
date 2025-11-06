// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { performance } = require("perf_hooks");
const XLSX = require('xlsx');
const DataValidator = require('./dataValidator');
const { isValidRecord, buildKey } = require("./validator");
const {
  appendRecordCSV,
  findByKeyCSV,
  existsKeyCSV,
  ensureFileWithHeader,
  readAllCSV,
  DATA_PATH,
} = require("./storage");
const { HashIndex } = require("./hashIndex");
const { Trie } = require("./trie");
const { BTree } = require("./btree");
const { CovidPriorityQueue } = require("./priorityQueue");
const { CovidBloomFilter } = require("./bloomFilter");
const { SirecoCache } = require("./cache");
const IndexManager = require("./indexManager");

const app = express();
app.use(cors());
app.use(express.json());

// Ruta al frontend
const FRONT_DIR = path.resolve(__dirname, "..", "frontend");
app.use(express.static(FRONT_DIR));

// Estructuras de datos en memoria
const indexByDate = new HashIndex();
const indexByCountry = new HashIndex();
const countryTrie = new Trie();
const dateIndex = new BTree(4); // B-Tree para rangos de fechas
const priorityQueue = new CovidPriorityQueue();
const bloomFilter = new CovidBloomFilter();
const cache = new SirecoCache();
const indexManager = new IndexManager();

function addToIndexes(rec) {
  indexByDate.add(rec.date, rec);
  indexByCountry.add(rec.country, rec);
  countryTrie.insert(rec.country);
  dateIndex.insert(rec.date, rec);
  priorityQueue.addCase(rec);
  bloomFilter.addRecord(rec);
}

async function buildIndexes() {
  indexByDate.clear();
  indexByCountry.clear();
  countryTrie.clear();
  dateIndex.clear();
  priorityQueue.clear();
  bloomFilter.clear();
  
  const all = await readAllCSV();
  for (const r of all) addToIndexes(r);
  
  console.log(`🔎 Índices construidos:`);
  console.log(`   - Hash: ${indexByDate.size()} fechas, ${indexByCountry.size()} países`);
  console.log(`   - Trie: ${countryTrie.getStats().totalWords} países únicos`);
  console.log(`   - BTree: ${dateIndex.getStats().size} registros por fecha`);
  console.log(`   - PriorityQueue: ${priorityQueue.size()} casos prioritarios`);
  console.log(`   - BloomFilter: ${bloomFilter.getStats().itemsAdded} elementos`);
  
  // 📁 Construir archivos de índice (Segunda Entrega)
  const indexFiles = indexManager.buildIndexFiles(all);
  console.log(`📁 Archivos de índice creados:`);
  console.log(`   - Países únicos: ${indexFiles.stats.uniqueCountries}`);
  console.log(`   - Fechas únicas: ${indexFiles.stats.uniqueDates}`);
  console.log(`   - Tipos únicos: ${indexFiles.stats.uniqueTypes}`);
  console.log(`   - Provincias únicas: ${indexFiles.stats.uniqueProvinces}`);
}

// ---------- Primera entrega ----------

// Crear registro (mejorado con Bloom Filter y cache)
app.post("/records", async (req, res) => {
  try {
    let { country, date, type, cases } = req.body ?? {};
    country = country?.trim();
    date = date?.trim();
    type = type?.trim()?.toLowerCase();
    cases = Number(cases);

    const record = { country, date, type, cases };
    const valid = isValidRecord(record);
    if (!valid.ok) return res.status(400).json({ ok: false, error: valid.error });

    // Verificación rápida con Bloom Filter
    if (bloomFilter.mightContainRecord(record)) {
      // Posible duplicado, verificar en CSV
      const key = buildKey(record);
      const exists = await existsKeyCSV(key);
      if (exists) {
        return res.status(409).json({ ok: false, error: "Ya existe un registro con esa clave" });
      }
    }

    await appendRecordCSV(record);
    addToIndexes(record);
    
    // Invalidar caches relacionados
    cache.invalidateForNewRecord(record);

    res.status(201).json({ ok: true, message: "Registro guardado", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error del servidor" });
  }
});

// Consultar por clave (country+date+type)
app.get("/records", async (req, res) => {
  try {
    const { country, date, type } = req.query;
    const probe = { country, date, type, cases: 0 };
    const valid = isValidRecord(probe, { skipCases: true });
    if (!valid.ok) return res.status(400).json({ ok: false, error: valid.error });

    const key = buildKey(probe);
    const found = await findByKeyCSV(key);
    if (!found) return res.status(404).json({ ok: false, error: "No encontrado" });

    res.json({ ok: true, record: found });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Error del servidor" });
  }
});

// ---------- Segunda entrega ----------
// Búsquedas rápidas con hash

app.get("/records/by-date/:date", (req, res) => {
  const date = req.params.date.trim();
  const t0 = performance.now();
  const list = indexByDate.find(date);
  const t1 = performance.now();

  if (list.length === 0)
    return res.status(404).json({ ok: false, error: "No hay registros para esa fecha" });

  res.json({
    ok: true,
    method: "hash",
    count: list.length,
    iterations: 1 + list.length,
    durationMs: +(t1 - t0).toFixed(3),
    records: list,
  });
});

app.get("/records/by-country/:country", (req, res) => {
  const country = req.params.country.trim();
  const t0 = performance.now();
  const list = indexByCountry.find(country);
  const t1 = performance.now();

  if (list.length === 0)
    return res.status(404).json({ ok: false, error: "No hay registros para ese país" });

  res.json({
    ok: true,
    method: "hash",
    count: list.length,
    iterations: 1 + list.length,
    durationMs: +(t1 - t0).toFixed(3),
    records: list,
  });
});

// ---------- Comparación con búsqueda tradicional ----------
// Escaneo completo (O(n))

app.get("/bench/scan-by-date/:date", async (req, res) => {
  const date = req.params.date.trim();
  const all = await readAllCSV();
  let iterations = 0;
  const t0 = performance.now();

  const out = [];
  for (const r of all) {
    iterations++;
    if (r.date === date) out.push(r);
  }

  const t1 = performance.now();
  if (out.length === 0)
    return res.status(404).json({ ok: false, error: "No hay registros para esa fecha" });

  res.json({
    ok: true,
    method: "scan",
    count: out.length,
    iterations,
    durationMs: +(t1 - t0).toFixed(3),
    records: out,
  });
});

app.get("/bench/scan-by-country/:country", async (req, res) => {
  const country = req.params.country.trim();
  const all = await readAllCSV();
  let iterations = 0;
  const t0 = performance.now();

  const out = [];
  for (const r of all) {
    iterations++;
    if (r.country === country) out.push(r);
  }

  const t1 = performance.now();
  if (out.length === 0)
    return res.status(404).json({ ok: false, error: "No hay registros para ese país" });

  res.json({
    ok: true,
    method: "scan",
    count: out.length,
    iterations,
    durationMs: +(t1 - t0).toFixed(3),
    records: out,
  });
});

// ---------- NUEVAS FUNCIONALIDADES AVANZADAS ----------

// Autocompletado de países con Trie
app.get("/autocomplete/countries", (req, res) => {
  try {
    const { prefix = "", limit = 10 } = req.query;
    const t0 = performance.now();
    
    const suggestions = countryTrie.autocomplete(prefix, parseInt(limit));
    const t1 = performance.now();
    
    res.json({
      ok: true,
      method: "trie",
      prefix,
      count: suggestions.length,
      durationMs: +(t1 - t0).toFixed(3),
      suggestions: suggestions.map(s => ({
        country: s.word,
        frequency: s.frequency
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error en autocompletado" });
  }
});

// Búsqueda por rango de fechas con BTree
app.get("/records/date-range", (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        ok: false, 
        error: "startDate y endDate son requeridos (formato YYYY-MM-DD)" 
      });
    }

    // Verificar cache primero
    const cached = cache.getRangeRecords(startDate, endDate);
    if (cached) {
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedResults = cached.slice(startIndex, startIndex + parseInt(limit));
      
      return res.json({
        ok: true,
        method: "btree-cached",
        startDate,
        endDate,
        total: cached.length,
        page: parseInt(page),
        limit: parseInt(limit),
        durationMs: 0.1,
        records: paginatedResults
      });
    }

    const t0 = performance.now();
    const records = dateIndex.rangeSearch(startDate, endDate);
    const t1 = performance.now();
    
    if (records.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "No hay registros en el rango especificado" 
      });
    }

    // Cachear resultado
    cache.cacheRangeRecords(startDate, endDate, records);
    
    // Paginación
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedResults = records.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      ok: true,
      method: "btree",
      startDate,
      endDate,
      total: records.length,
      page: parseInt(page),
      limit: parseInt(limit),
      durationMs: +(t1 - t0).toFixed(3),
      records: paginatedResults
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error en búsqueda por rango" });
  }
});

// Casos más críticos con Priority Queue
app.get("/records/critical", (req, res) => {
  try {
    const { count = 10 } = req.query;
    const t0 = performance.now();
    
    const criticalCases = priorityQueue.getMostCritical(parseInt(count));
    const t1 = performance.now();

    res.json({
      ok: true,
      method: "priority-queue",
      count: criticalCases.length,
      durationMs: +(t1 - t0).toFixed(3),
      records: criticalCases
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error obteniendo casos críticos" });
  }
});

// Estadísticas avanzadas
app.get("/stats", (req, res) => {
  try {
    // Verificar cache
    const cached = cache.getStats("general");
    if (cached) {
      return res.json({
        ok: true,
        method: "cached",
        durationMs: 0.1,
        ...cached
      });
    }

    const t0 = performance.now();
    
    // Estadísticas de Priority Queue
    const queueStats = priorityQueue.getStats();
    
    // Estadísticas por tipo
    const all = [];
    for (const node of priorityQueue.heap) {
      all.push(node.data);
    }
    
    const statsByCountry = {};
    const statsByDate = {};
    let totalCases = 0;
    
    for (const record of all) {
      totalCases += record.cases || 0;
      
      // Por país
      if (!statsByCountry[record.country]) {
        statsByCountry[record.country] = { confirmed: 0, death: 0, recovered: 0, total: 0 };
      }
      statsByCountry[record.country][record.type] += record.cases || 0;
      statsByCountry[record.country].total += record.cases || 0;
      
      // Por fecha
      if (!statsByDate[record.date]) {
        statsByDate[record.date] = { confirmed: 0, death: 0, recovered: 0, total: 0 };
      }
      statsByDate[record.date][record.type] += record.cases || 0;
      statsByDate[record.date].total += record.cases || 0;
    }
    
    const t1 = performance.now();
    
    const stats = {
      summary: {
        totalRecords: queueStats.total,
        totalCases,
        countries: queueStats.countries,
        dateRange: queueStats.dateRange,
        byType: {
          deaths: queueStats.deaths,
          confirmed: queueStats.confirmed,
          recovered: queueStats.recovered
        }
      },
      topCountries: Object.entries(statsByCountry)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([country, stats]) => ({ country, ...stats })),
      recentDates: Object.entries(statsByDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .map(([date, stats]) => ({ date, ...stats })),
      systemStats: {
        hashIndex: {
          dates: indexByDate.size(),
          countries: indexByCountry.size()
        },
        trie: countryTrie.getStats(),
        btree: dateIndex.getStats(),
        bloomFilter: bloomFilter.getStats(),
        cache: cache.getStats()
      }
    };
    
    // Cachear resultado
    cache.cacheStats("general", stats);
    
    res.json({
      ok: true,
      method: "computed",
      durationMs: +(t1 - t0).toFixed(3),
      ...stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error calculando estadísticas" });
  }
});

// Estadísticas por país específico
app.get("/stats/country/:country", (req, res) => {
  try {
    const country = req.params.country.trim();
    
    // Verificar cache
    const cached = cache.getCountryRecords(country);
    if (cached) {
      const stats = calculateCountryStats(cached, country);
      return res.json({
        ok: true,
        method: "cached",
        durationMs: 0.1,
        ...stats
      });
    }

    const t0 = performance.now();
    const records = indexByCountry.find(country);
    const t1 = performance.now();
    
    if (records.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "No hay registros para ese país" 
      });
    }

    // Cachear registros
    cache.cacheCountryRecords(country, records);
    
    const stats = calculateCountryStats(records, country);
    
    res.json({
      ok: true,
      method: "computed",
      durationMs: +(t1 - t0).toFixed(3),
      ...stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error calculando estadísticas del país" });
  }
});

// 📤 SISTEMA AVANZADO DE EXPORTACIÓN - JSON & EXCEL
app.get("/export/:format", async (req, res) => {
  try {
    const { format } = req.params;
    const { country, startDate, endDate, type, validate = 'true' } = req.query;
    
    // Validar formatos soportados
    if (!["json", "csv"].includes(format.toLowerCase())) {
      return res.status(400).json({ 
        ok: false, 
        error: "Formato no soportado. Use 'json' o 'csv'" 
      });
    }

    let records = await readAllCSV();
    const originalCount = records.length;
    
    // 🔍 VALIDACIÓN Y LIMPIEZA DE DATOS
    const validator = new DataValidator();
    const validationResult = validator.processData(records);
    
    // Log de validación
    console.log(`📊 Validación de datos:`);
    console.log(`- Registros totales: ${validationResult.stats.totalInput}`);
    console.log(`- Registros válidos: ${validationResult.stats.validRecords}`);
    console.log(`- Registros inválidos: ${validationResult.stats.invalidRecords}`);
    console.log(`- Tasa de error: ${validationResult.stats.errorRate}`);
    
    // Usar datos validados si está habilitado
    if (validate === 'true') {
      records = validationResult.cleanRecords;
      
      // Si hay muchos errores, advertir al cliente
      if (validationResult.invalidRecords.length > 0) {
        console.warn(`⚠️ Se excluyeron ${validationResult.invalidRecords.length} registros inválidos`);
      }
    }
    
    // ===== APLICAR FILTROS =====
    let appliedFilters = {};
    
    if (country) {
      records = records.filter(r => r.country.toLowerCase() === country.toLowerCase());
      appliedFilters.country = country;
    }
    if (startDate && endDate) {
      records = records.filter(r => r.date >= startDate && r.date <= endDate);
      appliedFilters.dateRange = { start: startDate, end: endDate };
    } else if (startDate) {
      records = records.filter(r => r.date >= startDate);
      appliedFilters.dateFrom = startDate;
    } else if (endDate) {
      records = records.filter(r => r.date <= endDate);
      appliedFilters.dateTo = endDate;
    }
    if (type) {
      records = records.filter(r => r.type.toLowerCase() === type.toLowerCase());
      appliedFilters.type = type;
    }

    // ===== GENERAR ESTADÍSTICAS =====
    const stats = generateExportStats(records);
    const timestamp = new Date().toISOString();
    const dateForFilename = new Date().toISOString().split('T')[0];
    
    // ===== EXPORTACIÓN JSON MEJORADA =====
    if (format.toLowerCase() === "json") {
      const exportData = {
        // Metadatos de exportación
        metadata: {
          exportedAt: timestamp,
          exportType: "COVID-19 Data Export",
          version: "SIRECOV v2.3.0",
          generatedBy: "Sistema Avanzado COVID",
          totalRecordsInDatabase: originalCount,
          recordsExported: records.length,
          filtersApplied: Object.keys(appliedFilters).length > 0 ? appliedFilters : null,
          dataValidation: {
            validationEnabled: validate === 'true',
            originalRecords: validationResult.stats.totalInput,
            validRecords: validationResult.stats.validRecords,
            invalidRecords: validationResult.stats.invalidRecords,
            errorRate: validationResult.stats.errorRate,
            hasErrors: validationResult.errors.length > 0,
            hasWarnings: validationResult.warnings.length > 0
          }
        },
        
        // Estadísticas del dataset
        statistics: stats,
        
        // Calidad de datos
        dataQuality: {
          errors: validationResult.errors.length > 0 ? validationResult.errors.slice(0, 10) : null,
          warnings: validationResult.warnings.length > 0 ? validationResult.warnings.slice(0, 10) : null,
          qualityScore: Math.round(100 - (validationResult.invalidRecords.length / validationResult.stats.totalInput * 100)),
          recommendations: generateDataRecommendations(validationResult)
        },
        
        // Estructura de datos
        schema: {
          fields: [
            { name: "country", type: "string", description: "País de registro" },
            { name: "date", type: "date", description: "Fecha del registro (YYYY-MM-DD)" },
            { name: "type", type: "string", description: "Tipo de caso", enum: ["confirmed", "death", "recovered"] },
            { name: "cases", type: "integer", description: "Número de casos registrados" }
          ]
        },
        
        // Datos principales
        data: records,
        
        // Información adicional
        export: {
          downloadUrl: req.originalUrl,
          recommendedFilename: `sirecov_covid_data_${dateForFilename}.json`,
          fileSize: JSON.stringify(records).length,
          checksum: generateSimpleChecksum(JSON.stringify(records))
        }
      };

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="sirecov_covid_data_${dateForFilename}.json"`);
      res.setHeader("X-Export-Records", records.length);
      res.setHeader("X-Export-Timestamp", timestamp);
      
      return res.json(exportData);
    }
    
    // ===== EXPORTACIÓN CSV =====
    if (format.toLowerCase() === "csv") {
      // Generar CSV con encabezados
      let csvContent = "country,date,type,cases\n";
      
      // Agregar datos
      for (const record of records) {
        csvContent += `"${record.country}","${record.date}","${record.type}",${record.cases}\n`;
      }
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="sirecov_covid_data_${dateForFilename}.csv"`);
      res.setHeader("X-Export-Records", records.length);
      res.setHeader("X-Export-Format", "CSV");
      
      return res.send(csvContent);
    }
    
    // Si llega aquí, formato no reconocido
    return res.status(400).json({ 
      ok: false, 
      error: "Formato no soportado. Use 'json' o 'csv'" 
    });
    
  } catch (err) {
    console.error("❌ Error en exportación:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Error exportando datos",
      details: err.message 
    });
  }
});

// Función auxiliar para generar estadísticas de exportación
function generateExportStats(records) {
  const stats = {
    totalRecords: records.length,
    totalCases: records.reduce((sum, r) => sum + (parseInt(r.cases) || 0), 0),
    uniqueCountries: [...new Set(records.map(r => r.country))].length,
    uniqueDates: [...new Set(records.map(r => r.date))].length,
    dateRange: {
      earliest: records.length > 0 ? Math.min(...records.map(r => new Date(r.date))) : null,
      latest: records.length > 0 ? Math.max(...records.map(r => new Date(r.date))) : null
    },
    byType: {},
    topCountries: []
  };
  
  // Estadísticas por tipo
  const typeGroups = records.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + parseInt(r.cases || 0);
    return acc;
  }, {});
  
  stats.byType = {
    confirmed: typeGroups.confirmed || 0,
    deaths: typeGroups.death || 0,
    recovered: typeGroups.recovered || 0
  };
  
  // Top países
  const countryGroups = records.reduce((acc, r) => {
    acc[r.country] = (acc[r.country] || 0) + parseInt(r.cases || 0);
    return acc;
  }, {});
  
  stats.topCountries = Object.entries(countryGroups)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([country, total]) => ({ país: country, totalCasos: total }));
  
  return stats;
}

// Función auxiliar para generar checksum simple
function generateSimpleChecksum(data) {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Función para generar recomendaciones de calidad de datos
function generateDataRecommendations(validationResult) {
  const recommendations = [];
  
  if (validationResult.invalidRecords.length > 0) {
    recommendations.push({
      type: 'error',
      message: `Se encontraron ${validationResult.invalidRecords.length} registros con errores críticos`,
      action: 'Revisar y corregir datos de entrada'
    });
  }
  
  if (validationResult.warnings.length > 0) {
    recommendations.push({
      type: 'warning', 
      message: `Se detectaron ${validationResult.warnings.length} advertencias de calidad`,
      action: 'Verificar fechas y valores atípicos'
    });
  }
  
  const errorRate = parseFloat(validationResult.stats.errorRate);
  if (errorRate > 10) {
    recommendations.push({
      type: 'critical',
      message: `Alta tasa de error: ${validationResult.stats.errorRate}`,
      action: 'Revisar proceso de captura de datos'
    });
  } else if (errorRate > 5) {
    recommendations.push({
      type: 'warning',
      message: `Tasa de error moderada: ${validationResult.stats.errorRate}`,
      action: 'Implementar validaciones adicionales'
    });
  } else {
    recommendations.push({
      type: 'success',
      message: 'Calidad de datos aceptable',
      action: 'Mantener estándares actuales'
    });
  }
  
  return recommendations;
}

// 🔍 ENDPOINT DE VALIDACIÓN DE DATOS
app.get("/data/validate", async (req, res) => {
  try {
    const records = await readAllCSV();
    const validator = new DataValidator();
    const validationResult = validator.processData(records);
    const report = validator.generateReport(validationResult);
    
    res.json({
      ok: true,
      validation: validationResult,
      report: report,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Error en validación:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Error validando datos",
      details: err.message 
    });
  }
});

// Información del sistema
app.get("/system/info", (req, res) => {
  try {
    res.json({
      ok: true,
      version: "2.0.0",
      dataStructures: {
        hashIndex: "Búsquedas O(1) por país/fecha",
        trie: "Autocompletado de países",
        btree: "Rangos de fechas eficientes", 
        priorityQueue: "Casos ordenados por severidad",
        bloomFilter: "Verificación ultrarrápida de duplicados",
        cache: "Cache LRU con TTL para consultas frecuentes"
      },
      endpoints: {
        basic: ["/records (GET/POST)"],
        advanced: [
          "/autocomplete/countries",
          "/records/date-range", 
          "/records/critical",
          "/stats",
          "/stats/country/:country",
          "/export/:format",
          "/system/info"
        ]
      },
      stats: {
        cache: cache.getStats(),
        bloomFilter: bloomFilter.getStats(),
        trie: countryTrie.getStats(),
        btree: dateIndex.getStats(),
        priorityQueue: priorityQueue.getStats()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error obteniendo información del sistema" });
  }
});

// Función auxiliar para estadísticas de país
function calculateCountryStats(records, country) {
  const stats = { confirmed: 0, death: 0, recovered: 0, total: 0 };
  const byDate = {};
  let firstDate = null, lastDate = null;
  
  for (const record of records) {
    stats[record.type] += record.cases || 0;
    stats.total += record.cases || 0;
    
    if (!byDate[record.date]) {
      byDate[record.date] = { confirmed: 0, death: 0, recovered: 0, total: 0 };
    }
    byDate[record.date][record.type] += record.cases || 0;
    byDate[record.date].total += record.cases || 0;
    
    if (!firstDate || record.date < firstDate) firstDate = record.date;
    if (!lastDate || record.date > lastDate) lastDate = record.date;
  }
  
  return {
    country,
    totalRecords: records.length,
    summary: stats,
    dateRange: { first: firstDate, last: lastDate },
    timeline: Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({ date, ...stats }))
  };
}

// ---------- Segunda Entrega - Consulta por Campo Único ----------

// Endpoint para consulta por país (campo único)
app.get("/search/country/:country", async (req, res) => {
  try {
    console.log('🎯 Endpoint /search/country llamado con:', req.params.country);
    const startTime = performance.now();
    const country = req.params.country;
    
    if (!country || country.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: "País requerido" 
      });
    }
    
    // Usar archivo de índice para búsqueda
    console.log('🔍 Buscando en índice countries...');
    const result = indexManager.searchByUniqueField('countries', country);
    console.log('📊 Resultado búsqueda:', result);
    const duration = performance.now() - startTime;
    
    if (result.found) {
      console.log('✅ País encontrado en índice:', result.result);
      
      return res.json({
        ok: true,
        searchType: 'unique_field_country',
        searchValue: country,
        found: true,
        totalRecords: result.result.positions.length,
        indexInfo: {
          totalCases: result.result.totalCases,
          lastUpdate: result.result.lastUpdate,
          searchTime: duration,
          positions: result.result.positions
        },
        message: `País encontrado con ${result.result.positions.length} registros`
      });
    } else {
      return res.json({
        ok: true,
        searchType: 'unique_field_country',
        searchValue: country,
        found: false,
        message: "No se encontraron registros para este país",
        suggestions: result.availableKeys ? result.availableKeys.slice(0, 5) : [],
        searchTime: duration
      });
    }
    
  } catch (error) {
    console.error('Error en búsqueda por país:', error);
    res.status(500).json({ 
      ok: false, 
      error: "Error interno del servidor" 
    });
  }
});

// Endpoint para consulta por fecha (campo único)
app.get("/search/date/:date", async (req, res) => {
  try {
    const startTime = performance.now();
    const date = req.params.date;
    
    if (!date || date.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: "Fecha requerida" 
      });
    }
    
    // Usar archivo de índice para búsqueda
    const result = indexManager.searchByUniqueField('dates', date);
    const duration = performance.now() - startTime;
    
    if (result.found) {
      // Obtener registros completos usando las posiciones del índice
      const allRecords = await readAllCSV();
      const matchingRecords = result.result.positions.map(pos => allRecords[pos]);
      
      return res.json({
        ok: true,
        searchType: 'unique_field_date',
        searchValue: date,
        found: true,
        totalRecords: matchingRecords.length,
        indexInfo: {
          totalCases: result.result.totalCases,
          countriesAffected: result.result.countries,
          typesReported: result.result.types,
          searchTime: duration
        },
        records: matchingRecords
      });
    } else {
      return res.json({
        ok: true,
        searchType: 'unique_field_date',
        searchValue: date,
        found: false,
        message: "No se encontraron registros para esta fecha",
        suggestions: result.availableKeys ? result.availableKeys.slice(0, 5) : [],
        searchTime: duration
      });
    }
    
  } catch (error) {
    console.error('Error en búsqueda por fecha:', error);
    res.status(500).json({ 
      ok: false, 
      error: "Error interno del servidor" 
    });
  }
});

// Endpoint para obtener información de archivos de índice
app.get("/index/info", (req, res) => {
  try {
    const stats = indexManager.getIndexStatistics();
    res.json({
      ok: true,
      indexFiles: stats,
      message: "Información de archivos de índice"
    });
  } catch (error) {
    console.error('Error obteniendo info de índices:', error);
    res.status(500).json({ 
      ok: false, 
      error: "Error obteniendo información de índices" 
    });
  }
});

// Endpoint para reconstruir archivos de índice
app.post("/index/rebuild", async (req, res) => {
  try {
    const startTime = performance.now();
    
    // Leer todos los registros y reconstruir índices
    const allRecords = await readAllCSV();
    const indexFiles = indexManager.buildIndexFiles(allRecords);
    
    const duration = performance.now() - startTime;
    
    res.json({
      ok: true,
      message: "Archivos de índice reconstruidos exitosamente",
      stats: indexFiles.stats,
      rebuildTime: duration
    });
    
  } catch (error) {
    console.error('Error reconstruyendo índices:', error);
    res.status(500).json({ 
      ok: false, 
      error: "Error reconstruyendo archivos de índice" 
    });
  }
});

// Debug de Excel - página de prueba específica
app.get("/debug-excel", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "test-excel-debug.html"));
});

// Test Excel mínimo para debugging
app.get("/test-excel-minimal", (req, res) => {
  try {
    console.log("🧪 Generando Excel mínimo para test...");
    
    // Crear workbook simple
    const workbook = XLSX.utils.book_new();
    
    // Datos de prueba mínimos
    const testData = [
      { País: "Colombia", Fecha: "2023-01-01", Tipo: "confirmed", Casos: 100 },
      { País: "Brasil", Fecha: "2023-01-01", Tipo: "confirmed", Casos: 200 }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(testData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test");
    
    // Generar buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });
    
    console.log(`🔍 Buffer test generado: ${buffer.length} bytes`);
    console.log(`🔍 Es Buffer?:`, Buffer.isBuffer(buffer));
    console.log(`🔍 Primeros 4 bytes (hex):`, buffer.slice(0, 4).toString('hex'));
    
    // Configurar cabeceras
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="test-minimal.xlsx"');
    res.setHeader("Content-Length", buffer.length);
    
    // Enviar buffer directamente
    res.end(buffer);
    
  } catch (error) {
    console.error("❌ Error en test Excel:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test de exportación - página de prueba
app.get("/test-export", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test de Exportación SIRECOV</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            button { padding: 10px 20px; margin: 5px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #3182ce; }
            #results { margin-top: 20px; padding: 15px; border: 2px solid #e2e8f0; border-radius: 8px; background: #f7fafc; }
            .success { color: #38a169; }
            .error { color: #e53e3e; }
        </style>
    </head>
    <body>
        <h1>🧪 Test Directo de Exportación SIRECOV</h1>
        
        <div>
            <h3>📊 Pruebas de Descarga</h3>
            <button onclick="testDirectExport('json')">📄 Descargar JSON</button>
            <button onclick="testDirectExport('csv')">📊 Descargar CSV</button>
            <button onclick="testFilteredExport('json', 'colombia')">🇨🇴 JSON Colombia</button>
            <button onclick="testFilteredExport('csv', 'confirmed')">✅ CSV Confirmados</button>
        </div>
        
        <div id="results">
            <strong>🎯 Haz clic en un botón para probar la descarga...</strong>
        </div>

        <script>
            console.log('🧪 Test de exportación inicializado');
            
            async function testDirectExport(format) {
                const results = document.getElementById('results');
                results.innerHTML = '<div class="loading">🔄 Descargando ' + format.toUpperCase() + '...</div>';
                
                try {
                    const response = await fetch('/export/' + format);
                    
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    
                    let content, filename, mimeType;
                    
                    if (format === 'json') {
                        const data = await response.json();
                        content = JSON.stringify(data, null, 2);
                        filename = 'sirecov_test_' + Date.now() + '.json';
                        mimeType = 'application/json';
                        
                        results.innerHTML = '<div class="success">✅ JSON descargado: ' + data.totalRecords + ' registros</div>';
                    } else {
                        content = await response.text();
                        filename = 'sirecov_test_' + Date.now() + '.csv';
                        mimeType = 'text/csv';
                        
                        const lines = content.split('\\n').filter(line => line.trim()).length;
                        results.innerHTML = '<div class="success">✅ CSV descargado: ' + (lines - 1) + ' registros</div>';
                    }
                    
                    // Crear y descargar archivo
                    const blob = new Blob([content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                } catch (error) {
                    results.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
                    console.error('Error en test:', error);
                }
            }
            
            async function testFilteredExport(format, filter) {
                const results = document.getElementById('results');
                results.innerHTML = '<div class="loading">🔄 Descargando ' + format.toUpperCase() + ' filtrado...</div>';
                
                try {
                    let url = '/export/' + format + '?';
                    if (filter === 'colombia') {
                        url += 'country=' + filter;
                    } else if (filter === 'confirmed') {
                        url += 'type=' + filter;
                    }
                    
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    
                    let content, filename, recordCount;
                    
                    if (format === 'json') {
                        const data = await response.json();
                        content = JSON.stringify(data, null, 2);
                        filename = filter + '_export_' + Date.now() + '.json';
                        recordCount = data.totalRecords;
                    } else {
                        content = await response.text();
                        filename = filter + '_export_' + Date.now() + '.csv';
                        recordCount = content.split('\\n').filter(line => line.trim()).length - 1;
                    }
                    
                    results.innerHTML = '<div class="success">✅ ' + format.toUpperCase() + ' filtrado descargado: ' + recordCount + ' registros (' + filter + ')</div>';
                    
                    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
                    const url2 = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url2;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url2);
                    
                } catch (error) {
                    results.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
                    console.error('Error en test filtrado:', error);
                }
            }
        </script>
    </body>
    </html>
  `);
});

// ---------- Fallback (frontend) ----------
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(FRONT_DIR, "index.html"));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await ensureFileWithHeader();
  await buildIndexes();
  console.log(`✅ SIRECOV corriendo en http://localhost:${PORT}`);
});
