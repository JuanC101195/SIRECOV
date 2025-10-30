// backend/bloomFilter.js
// Implementación de Bloom Filter para verificación ultrarrápida de existencia

class BloomFilter {
  constructor(expectedElements = 10000, falsePositiveRate = 0.01) {
    this.expectedElements = expectedElements;
    this.falsePositiveRate = falsePositiveRate;
    
    // Calcular el tamaño óptimo del array de bits
    this.size = this._calculateOptimalSize(expectedElements, falsePositiveRate);
    
    // Calcular el número óptimo de funciones hash
    this.numHashes = this._calculateOptimalHashFunctions(this.size, expectedElements);
    
    // Array de bits (usando array de booleanos)
    this.bitArray = new Array(this.size).fill(false);
    
    // Contador de elementos agregados
    this.itemsAdded = 0;
    
    // Estadísticas
    this.stats = {
      totalChecks: 0,
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0
    };
  }

  /**
   * Calcula el tamaño óptimo del filtro
   * @param {number} n - Número esperado de elementos
   * @param {number} p - Tasa de falsos positivos deseada
   * @returns {number}
   */
  _calculateOptimalSize(n, p) {
    return Math.ceil(-n * Math.log(p) / (Math.log(2) ** 2));
  }

  /**
   * Calcula el número óptimo de funciones hash
   * @param {number} m - Tamaño del filtro
   * @param {number} n - Número esperado de elementos
   * @returns {number}
   */
  _calculateOptimalHashFunctions(m, n) {
    return Math.ceil((m / n) * Math.log(2));
  }

  /**
   * Genera múltiples valores hash para un elemento
   * @param {string} item - El elemento a hashear
   * @returns {Array<number>}
   */
  _getHashes(item) {
    const hashes = [];
    const str = String(item);
    
    // Primera función hash (FNV-1a)
    let hash1 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash1 ^= str.charCodeAt(i);
      hash1 = Math.imul(hash1, 0x01000193) >>> 0;
    }
    
    // Segunda función hash (djb2)
    let hash2 = 5381;
    for (let i = 0; i < str.length; i++) {
      hash2 = ((hash2 << 5) + hash2) + str.charCodeAt(i);
    }
    hash2 = hash2 >>> 0;
    
    // Generar múltiples hashes usando combinación lineal
    for (let i = 0; i < this.numHashes; i++) {
      const combinedHash = (hash1 + i * hash2) >>> 0;
      hashes.push(combinedHash % this.size);
    }
    
    return hashes;
  }

  /**
   * Agrega un elemento al filtro
   * @param {*} item - El elemento a agregar
   */
  add(item) {
    if (item === null || item === undefined) return;
    
    const hashes = this._getHashes(item);
    
    for (const hash of hashes) {
      this.bitArray[hash] = true;
    }
    
    this.itemsAdded++;
  }

  /**
   * Verifica si un elemento podría estar en el filtro
   * @param {*} item - El elemento a verificar
   * @returns {boolean} - true si podría estar, false si definitivamente no está
   */
  mightContain(item) {
    if (item === null || item === undefined) return false;
    
    this.stats.totalChecks++;
    
    const hashes = this._getHashes(item);
    
    for (const hash of hashes) {
      if (!this.bitArray[hash]) {
        this.stats.trueNegatives++;
        return false; // Definitivamente no está
      }
    }
    
    // Podría estar (posible falso positivo)
    return true;
  }

  /**
   * Verifica la existencia con estadísticas
   * @param {*} item - El elemento a verificar
   * @param {boolean} actualExists - Si el elemento realmente existe (para estadísticas)
   * @returns {boolean}
   */
  checkWithStats(item, actualExists = null) {
    const result = this.mightContain(item);
    
    if (actualExists !== null) {
      if (result && actualExists) {
        this.stats.truePositives++;
      } else if (result && !actualExists) {
        this.stats.falsePositives++;
      }
      // trueNegatives ya se cuenta en mightContain
    }
    
    return result;
  }

  /**
   * Obtiene la tasa actual de falsos positivos
   * @returns {number}
   */
  getCurrentFalsePositiveRate() {
    const bitsSet = this.bitArray.filter(bit => bit).length;
    const ratio = bitsSet / this.size;
    return Math.pow(ratio, this.numHashes);
  }

  /**
   * Verifica si el filtro está cerca de su capacidad
   * @returns {boolean}
   */
  isNearCapacity() {
    return this.itemsAdded >= this.expectedElements * 0.8;
  }

  /**
   * Obtiene estadísticas del filtro
   * @returns {Object}
   */
  getStats() {
    const bitsSet = this.bitArray.filter(bit => bit).length;
    const utilization = (bitsSet / this.size) * 100;
    const estimatedFPR = this.getCurrentFalsePositiveRate();
    
    return {
      size: this.size,
      numHashes: this.numHashes,
      itemsAdded: this.itemsAdded,
      expectedElements: this.expectedElements,
      targetFPR: this.falsePositiveRate,
      currentFPR: estimatedFPR,
      utilization: utilization.toFixed(2) + '%',
      bitsSet: bitsSet,
      nearCapacity: this.isNearCapacity(),
      checks: { ...this.stats }
    };
  }

  /**
   * Limpia el filtro
   */
  clear() {
    this.bitArray.fill(false);
    this.itemsAdded = 0;
    this.stats = {
      totalChecks: 0,
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0
    };
  }

  /**
   * Crea una copia del filtro
   * @returns {BloomFilter}
   */
  clone() {
    const clone = new BloomFilter(this.expectedElements, this.falsePositiveRate);
    clone.bitArray = [...this.bitArray];
    clone.itemsAdded = this.itemsAdded;
    clone.stats = { ...this.stats };
    return clone;
  }

  /**
   * Une este filtro con otro (OR lógico)
   * @param {BloomFilter} otherFilter 
   * @returns {boolean} - true si la unión fue exitosa
   */
  union(otherFilter) {
    if (this.size !== otherFilter.size || this.numHashes !== otherFilter.numHashes) {
      return false; // Filtros incompatibles
    }
    
    for (let i = 0; i < this.size; i++) {
      this.bitArray[i] = this.bitArray[i] || otherFilter.bitArray[i];
    }
    
    // Actualizar estadísticas (aproximación)
    this.itemsAdded = Math.max(this.itemsAdded, otherFilter.itemsAdded);
    
    return true;
  }

  /**
   * Exporta el filtro a un formato serializable
   * @returns {Object}
   */
  serialize() {
    return {
      expectedElements: this.expectedElements,
      falsePositiveRate: this.falsePositiveRate,
      size: this.size,
      numHashes: this.numHashes,
      bitArray: this.bitArray,
      itemsAdded: this.itemsAdded,
      stats: this.stats
    };
  }

  /**
   * Importa un filtro desde un formato serializado
   * @param {Object} data 
   * @returns {BloomFilter}
   */
  static deserialize(data) {
    const filter = new BloomFilter(data.expectedElements, data.falsePositiveRate);
    filter.size = data.size;
    filter.numHashes = data.numHashes;
    filter.bitArray = data.bitArray;
    filter.itemsAdded = data.itemsAdded;
    filter.stats = data.stats;
    return filter;
  }
}

/**
 * Bloom Filter específico para claves de registros COVID
 */
class CovidBloomFilter extends BloomFilter {
  constructor(expectedElements = 50000, falsePositiveRate = 0.001) {
    super(expectedElements, falsePositiveRate);
  }

  /**
   * Agrega un registro COVID al filtro
   * @param {Object} record - Registro COVID
   */
  addRecord(record) {
    if (!record) return;
    
    const key = this._buildKey(record);
    this.add(key);
  }

  /**
   * Verifica si un registro podría existir
   * @param {Object} record - Registro COVID
   * @returns {boolean}
   */
  mightContainRecord(record) {
    if (!record) return false;
    
    const key = this._buildKey(record);
    return this.mightContain(key);
  }

  /**
   * Construye la clave única del registro
   * @param {Object} record 
   * @returns {string}
   */
  _buildKey(record) {
    if (!record.country || !record.date || !record.type) {
      return '';
    }
    
    return `${record.country.toLowerCase()}|${record.date}|${record.type.toLowerCase()}`;
  }

  /**
   * Agrega múltiples registros de una vez
   * @param {Array<Object>} records 
   */
  addBatch(records) {
    if (!Array.isArray(records)) return;
    
    for (const record of records) {
      this.addRecord(record);
    }
  }
}

module.exports = { 
  BloomFilter, 
  CovidBloomFilter 
};