// backend/cache.js
// Sistema de caché LRU (Least Recently Used) con TTL (Time To Live)

class CacheNode {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.ttl = ttl;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 1;
    this.prev = null;
    this.next = null;
  }

  /**
   * Verifica si el nodo ha expirado
   * @returns {boolean}
   */
  isExpired() {
    if (this.ttl === null) return false;
    return Date.now() - this.createdAt > this.ttl;
  }

  /**
   * Actualiza el tiempo de último acceso
   */
  touch() {
    this.lastAccessed = Date.now();
    this.accessCount++;
  }
}

class LRUCache {
  constructor(capacity = 1000, defaultTTL = null) {
    this.capacity = capacity;
    this.defaultTTL = defaultTTL;
    this.cache = new Map(); // key -> CacheNode
    
    // Lista doblemente enlazada para LRU
    this.head = new CacheNode('HEAD', null);
    this.tail = new CacheNode('TAIL', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    // Estadísticas
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0
    };
    
    // Limpieza automática de expirados
    this._startCleanupTimer();
  }

  /**
   * Obtiene un valor del caché
   * @param {string} key - La clave
   * @returns {*} - El valor o null si no existe/expiró
   */
  get(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      this.stats.misses++;
      return null;
    }
    
    if (node.isExpired()) {
      this._removeNode(node);
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      return null;
    }
    
    // Mover al frente (más recientemente usado)
    this._moveToHead(node);
    node.touch();
    this.stats.hits++;
    
    return node.value;
  }

  /**
   * Establece un valor en el caché
   * @param {string} key - La clave
   * @param {*} value - El valor
   * @param {number|null} ttl - TTL específico o usa el por defecto
   */
  set(key, value, ttl = this.defaultTTL) {
    let node = this.cache.get(key);
    
    if (node) {
      // Actualizar valor existente
      node.value = value;
      node.ttl = ttl;
      node.createdAt = Date.now();
      node.touch();
      this._moveToHead(node);
    } else {
      // Nuevo nodo
      node = new CacheNode(key, value, ttl);
      
      if (this.cache.size >= this.capacity) {
        // Evictar el menos usado
        const tail = this.tail.prev;
        this._removeNode(tail);
        this.cache.delete(tail.key);
        this.stats.evictions++;
      }
      
      this.cache.set(key, node);
      this._addToHead(node);
    }
    
    this.stats.sets++;
  }

  /**
   * Elimina una clave del caché
   * @param {string} key - La clave a eliminar
   * @returns {boolean} - true si se eliminó, false si no existía
   */
  delete(key) {
    const node = this.cache.get(key);
    
    if (!node) return false;
    
    this._removeNode(node);
    this.cache.delete(key);
    this.stats.deletes++;
    
    return true;
  }

  /**
   * Verifica si una clave existe y no ha expirado
   * @param {string} key - La clave
   * @returns {boolean}
   */
  has(key) {
    const node = this.cache.get(key);
    
    if (!node) return false;
    
    if (node.isExpired()) {
      this._removeNode(node);
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Limpia todo el caché
   */
  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    // Reset stats except hits/misses para mantener el ratio
    this.stats.sets = 0;
    this.stats.deletes = 0;
    this.stats.evictions = 0;
    this.stats.expirations = 0;
  }

  /**
   * Obtiene el tamaño actual del caché
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * Obtiene todas las claves (sin expiradas)
   * @returns {Array<string>}
   */
  keys() {
    this._cleanupExpired();
    return Array.from(this.cache.keys());
  }

  /**
   * Obtiene estadísticas del caché
   * @returns {Object}
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: ((this.cache.size / this.capacity) * 100).toFixed(2) + '%',
      hitRate: hitRate + '%',
      ...this.stats,
      totalRequests
    };
  }

  /**
   * Obtiene información detallada de las entradas
   * @param {number} limit - Número máximo de entradas a mostrar
   * @returns {Array}
   */
  getEntries(limit = 10) {
    const entries = [];
    let current = this.head.next;
    let count = 0;
    
    while (current !== this.tail && count < limit) {
      if (!current.isExpired()) {
        entries.push({
          key: current.key,
          size: this._getValueSize(current.value),
          age: Date.now() - current.createdAt,
          lastAccessed: Date.now() - current.lastAccessed,
          accessCount: current.accessCount,
          ttl: current.ttl,
          expired: current.isExpired()
        });
        count++;
      }
      current = current.next;
    }
    
    return entries;
  }

  /**
   * Limpia entradas expiradas manualmente
   * @returns {number} - Número de entradas limpiadas
   */
  cleanup() {
    return this._cleanupExpired();
  }

  // Métodos privados

  _addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  _cleanupExpired() {
    let cleaned = 0;
    const toDelete = [];
    
    for (const [key, node] of this.cache) {
      if (node.isExpired()) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      const node = this.cache.get(key);
      if (node) {
        this._removeNode(node);
        this.cache.delete(key);
        cleaned++;
        this.stats.expirations++;
      }
    }
    
    return cleaned;
  }

  _startCleanupTimer() {
    // Limpieza automática cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 5 * 60 * 1000);
  }

  _getValueSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  /**
   * Destructor - limpia el timer
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Cache especializado para SIRECOV
 */
class SirecoCache extends LRUCache {
  constructor(capacity = 1000) {
    // TTL por defecto de 15 minutos
    super(capacity, 15 * 60 * 1000);
  }

  /**
   * Cache para búsquedas por país
   * @param {string} country 
   * @param {Array} records 
   */
  cacheCountryRecords(country, records) {
    const key = `country:${country.toLowerCase()}`;
    this.set(key, records, 10 * 60 * 1000); // 10 minutos para países
  }

  /**
   * Obtiene registros cacheados por país
   * @param {string} country 
   * @returns {Array|null}
   */
  getCountryRecords(country) {
    const key = `country:${country.toLowerCase()}`;
    return this.get(key);
  }

  /**
   * Cache para búsquedas por fecha
   * @param {string} date 
   * @param {Array} records 
   */
  cacheDateRecords(date, records) {
    const key = `date:${date}`;
    this.set(key, records, 5 * 60 * 1000); // 5 minutos para fechas
  }

  /**
   * Obtiene registros cacheados por fecha
   * @param {string} date 
   * @returns {Array|null}
   */
  getDateRecords(date) {
    const key = `date:${date}`;
    return this.get(key);
  }

  /**
   * Cache para estadísticas
   * @param {string} type 
   * @param {Object} stats 
   */
  cacheStats(type, stats) {
    const key = `stats:${type}`;
    this.set(key, stats, 2 * 60 * 1000); // 2 minutos para estadísticas
  }

  /**
   * Obtiene estadísticas cacheadas
   * @param {string} type 
   * @returns {Object|null}
   */
  getStats(type) {
    const key = `stats:${type}`;
    return this.get(key);
  }

  /**
   * Cache para rangos de fechas
   * @param {string} startDate 
   * @param {string} endDate 
   * @param {Array} records 
   */
  cacheRangeRecords(startDate, endDate, records) {
    const key = `range:${startDate}:${endDate}`;
    this.set(key, records, 8 * 60 * 1000); // 8 minutos para rangos
  }

  /**
   * Obtiene registros cacheados por rango
   * @param {string} startDate 
   * @param {string} endDate 
   * @returns {Array|null}
   */
  getRangeRecords(startDate, endDate) {
    const key = `range:${startDate}:${endDate}`;
    return this.get(key);
  }

  /**
   * Invalida caches relacionados cuando se agrega un registro
   * @param {Object} record 
   */
  invalidateForNewRecord(record) {
    if (!record) return;
    
    // Invalidar caches relacionados
    const patterns = [
      `country:${record.country?.toLowerCase()}`,
      `date:${record.date}`,
      `stats:`,
      `range:`
    ];
    
    for (const key of this.keys()) {
      for (const pattern of patterns) {
        if (key.startsWith(pattern)) {
          this.delete(key);
        }
      }
    }
  }
}

module.exports = { 
  LRUCache, 
  CacheNode, 
  SirecoCache 
};