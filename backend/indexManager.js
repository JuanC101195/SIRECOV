/**
 * SIRECOV - Index Manager
 * Sistema de gestión de archivos de índice para la segunda entrega
 * Maneja la persistencia y recuperación de índices en archivos
 */

const fs = require('fs');
const path = require('path');

class IndexManager {
  constructor() {
    this.indexDir = path.join(__dirname, '..', 'indexes');
    this.indexFiles = {
      countries: path.join(this.indexDir, 'countries_index.json'),
      dates: path.join(this.indexDir, 'dates_index.json'),
      types: path.join(this.indexDir, 'types_index.json'),
      provinces: path.join(this.indexDir, 'provinces_index.json')
    };
    
    // Crear directorio de índices si no existe
    this.ensureIndexDirectory();
  }

  /**
   * Asegurar que el directorio de índices existe
   */
  ensureIndexDirectory() {
    if (!fs.existsSync(this.indexDir)) {
      fs.mkdirSync(this.indexDir, { recursive: true });
      console.log('📁 Directorio de índices creado:', this.indexDir);
    }
  }

  /**
   * Construir índices desde los datos y guardarlos en archivos
   * @param {Array} records - Registros de COVID
   */
  buildIndexFiles(records) {
    console.log('🔧 Construyendo archivos de índice...');
    
    const startTime = Date.now();
    
    // Índice por país (campo único - no repetido)
    const countryIndex = this.buildCountryIndex(records);
    
    // Índice por fecha (campo único - no repetido) 
    const dateIndex = this.buildDateIndex(records);
    
    // Índice por tipo de caso (campo con valores limitados)
    const typeIndex = this.buildTypeIndex(records);
    
    // Índice por provincia/estado (campo semi-único)
    const provinceIndex = this.buildProvinceIndex(records);
    
    // Guardar índices en archivos
    this.saveIndex('countries', countryIndex);
    this.saveIndex('dates', dateIndex);
    this.saveIndex('types', typeIndex);
    this.saveIndex('provinces', provinceIndex);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Archivos de índice construidos en ${duration}ms`);
    
    return {
      countries: countryIndex,
      dates: dateIndex,
      types: typeIndex,
      provinces: provinceIndex,
      stats: {
        totalRecords: records.length,
        uniqueCountries: Object.keys(countryIndex).length,
        uniqueDates: Object.keys(dateIndex).length,
        uniqueTypes: Object.keys(typeIndex).length,
        uniqueProvinces: Object.keys(provinceIndex).length,
        buildTime: duration
      }
    };
  }

  /**
   * Construir índice por país (campo único)
   * Cada país apunta a las posiciones de sus registros
   */
  buildCountryIndex(records) {
    const index = {};
    
    records.forEach((record, position) => {
      const country = record.country?.toLowerCase().trim();
      if (country) {
        if (!index[country]) {
          index[country] = {
            name: record.country, // Nombre original
            positions: [],
            totalCases: 0,
            lastUpdate: null
          };
        }
        
        index[country].positions.push(position);
        index[country].totalCases += parseInt(record.cases) || 0;
        
        // Actualizar fecha más reciente
        if (record.date && (!index[country].lastUpdate || record.date > index[country].lastUpdate)) {
          index[country].lastUpdate = record.date;
        }
      }
    });
    
    return index;
  }

  /**
   * Construir índice por fecha (campo único)
   * Cada fecha apunta a las posiciones de sus registros
   */
  buildDateIndex(records) {
    const index = {};
    
    records.forEach((record, position) => {
      const date = record.date?.trim();
      if (date) {
        if (!index[date]) {
          index[date] = {
            positions: [],
            totalCases: 0,
            countries: new Set(),
            types: new Set()
          };
        }
        
        index[date].positions.push(position);
        index[date].totalCases += parseInt(record.cases) || 0;
        
        if (record.country) index[date].countries.add(record.country);
        if (record.type) index[date].types.add(record.type);
      }
    });
    
    // Convertir Sets a Arrays para serialización JSON
    Object.keys(index).forEach(date => {
      index[date].countries = Array.from(index[date].countries);
      index[date].types = Array.from(index[date].types);
    });
    
    return index;
  }

  /**
   * Construir índice por tipo de caso
   */
  buildTypeIndex(records) {
    const index = {};
    
    records.forEach((record, position) => {
      const type = record.type?.toLowerCase().trim();
      if (type) {
        if (!index[type]) {
          index[type] = {
            name: record.type, // Nombre original
            positions: [],
            totalCases: 0,
            countries: new Set()
          };
        }
        
        index[type].positions.push(position);
        index[type].totalCases += parseInt(record.cases) || 0;
        
        if (record.country) index[type].countries.add(record.country);
      }
    });
    
    // Convertir Sets a Arrays
    Object.keys(index).forEach(type => {
      index[type].countries = Array.from(index[type].countries);
    });
    
    return index;
  }

  /**
   * Construir índice por provincia/estado
   */
  buildProvinceIndex(records) {
    const index = {};
    
    records.forEach((record, position) => {
      const province = record.province?.trim();
      if (province && province !== '') {
        const key = `${record.country}_${province}`.toLowerCase();
        
        if (!index[key]) {
          index[key] = {
            country: record.country,
            province: province,
            positions: [],
            totalCases: 0
          };
        }
        
        index[key].positions.push(position);
        index[key].totalCases += parseInt(record.cases) || 0;
      }
    });
    
    return index;
  }

  /**
   * Guardar índice en archivo
   * @param {string} indexName - Nombre del índice
   * @param {Object} indexData - Datos del índice
   */
  saveIndex(indexName, indexData) {
    try {
      const filePath = this.indexFiles[indexName];
      const metadata = {
        indexName,
        createdAt: new Date().toISOString(),
        recordCount: Object.keys(indexData).length,
        totalSize: JSON.stringify(indexData).length
      };
      
      const indexFile = {
        metadata,
        index: indexData
      };
      
      fs.writeFileSync(filePath, JSON.stringify(indexFile, null, 2));
      console.log(`💾 Índice ${indexName} guardado: ${filePath}`);
      
    } catch (error) {
      console.error(`❌ Error guardando índice ${indexName}:`, error);
    }
  }

  /**
   * Cargar índice desde archivo
   * @param {string} indexName - Nombre del índice
   * @returns {Object} Datos del índice o null si no existe
   */
  loadIndex(indexName) {
    try {
      const filePath = this.indexFiles[indexName];
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Archivo de índice ${indexName} no encontrado`);
        return null;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const indexFile = JSON.parse(fileContent);
      
      console.log(`📖 Índice ${indexName} cargado desde archivo`);
      return indexFile.index;
      
    } catch (error) {
      console.error(`❌ Error cargando índice ${indexName}:`, error);
      return null;
    }
  }

  /**
   * Cargar todos los índices desde archivos
   * @returns {Object} Todos los índices cargados
   */
  loadAllIndexes() {
    const indexes = {};
    
    Object.keys(this.indexFiles).forEach(indexName => {
      indexes[indexName] = this.loadIndex(indexName);
    });
    
    return indexes;
  }

  /**
   * Buscar en índice por campo único (implementación académica)
   * @param {string} indexName - Nombre del índice
   * @param {string} searchValue - Valor a buscar
   * @returns {Object} Resultado de la búsqueda
   */
  searchByUniqueField(indexName, searchValue) {
    const startTime = Date.now();
    
    const index = this.loadIndex(indexName);
    if (!index) {
      return {
        found: false,
        error: `Índice ${indexName} no disponible`,
        searchTime: Date.now() - startTime
      };
    }
    
    const normalizedSearch = searchValue.toLowerCase().trim();
    const result = index[normalizedSearch];
    
    if (result) {
      return {
        found: true,
        indexName,
        searchValue,
        result,
        searchTime: Date.now() - startTime,
        method: 'index_file_search'
      };
    } else {
      return {
        found: false,
        indexName,
        searchValue,
        availableKeys: Object.keys(index).slice(0, 10), // Primeras 10 opciones
        searchTime: Date.now() - startTime,
        method: 'index_file_search'
      };
    }
  }

  /**
   * Obtener estadísticas de todos los índices
   */
  getIndexStatistics() {
    const stats = {};
    
    Object.keys(this.indexFiles).forEach(indexName => {
      const filePath = this.indexFiles[indexName];
      
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const indexFile = JSON.parse(fileContent);
          
          stats[indexName] = {
            ...indexFile.metadata,
            fileSize: fs.statSync(filePath).size,
            filePath
          };
        } catch (error) {
          stats[indexName] = { error: error.message };
        }
      } else {
        stats[indexName] = { status: 'not_found' };
      }
    });
    
    return stats;
  }
}

module.exports = IndexManager;