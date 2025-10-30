// backend/priorityQueue.js
// Cola de prioridad para manejar casos COVID por severidad

class PriorityQueueNode {
  constructor(data, priority) {
    this.data = data;
    this.priority = priority;
  }
}

class PriorityQueue {
  constructor(compareFn = null) {
    this.heap = [];
    // Función de comparación personalizada o por defecto (max-heap)
    this.compare = compareFn || ((a, b) => b.priority - a.priority);
  }

  /**
   * Obtiene el índice del padre
   * @param {number} index 
   * @returns {number}
   */
  _parentIndex(index) {
    return Math.floor((index - 1) / 2);
  }

  /**
   * Obtiene el índice del hijo izquierdo
   * @param {number} index 
   * @returns {number}
   */
  _leftChildIndex(index) {
    return 2 * index + 1;
  }

  /**
   * Obtiene el índice del hijo derecho
   * @param {number} index 
   * @returns {number}
   */
  _rightChildIndex(index) {
    return 2 * index + 2;
  }

  /**
   * Intercambia dos elementos en el heap
   * @param {number} i 
   * @param {number} j 
   */
  _swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /**
   * Reestablece la propiedad del heap hacia arriba
   * @param {number} index 
   */
  _heapifyUp(index) {
    while (index > 0) {
      const parentIdx = this._parentIndex(index);
      if (this.compare(this.heap[index], this.heap[parentIdx]) <= 0) {
        break;
      }
      this._swap(index, parentIdx);
      index = parentIdx;
    }
  }

  /**
   * Reestablece la propiedad del heap hacia abajo
   * @param {number} index 
   */
  _heapifyDown(index) {
    while (this._leftChildIndex(index) < this.heap.length) {
      const leftIdx = this._leftChildIndex(index);
      const rightIdx = this._rightChildIndex(index);
      let maxIdx = leftIdx;

      if (rightIdx < this.heap.length && 
          this.compare(this.heap[rightIdx], this.heap[leftIdx]) > 0) {
        maxIdx = rightIdx;
      }

      if (this.compare(this.heap[index], this.heap[maxIdx]) >= 0) {
        break;
      }

      this._swap(index, maxIdx);
      index = maxIdx;
    }
  }

  /**
   * Inserta un elemento en la cola de prioridad
   * @param {*} data - Los datos del elemento
   * @param {number} priority - La prioridad del elemento
   */
  enqueue(data, priority) {
    const node = new PriorityQueueNode(data, priority);
    this.heap.push(node);
    this._heapifyUp(this.heap.length - 1);
  }

  /**
   * Extrae el elemento con mayor prioridad
   * @returns {*} - El elemento con mayor prioridad o null si está vacía
   */
  dequeue() {
    if (this.isEmpty()) return null;

    if (this.heap.length === 1) {
      return this.heap.pop().data;
    }

    const max = this.heap[0].data;
    this.heap[0] = this.heap.pop();
    this._heapifyDown(0);
    return max;
  }

  /**
   * Obtiene el elemento con mayor prioridad sin extraerlo
   * @returns {*} - El elemento con mayor prioridad o null si está vacía
   */
  peek() {
    return this.isEmpty() ? null : this.heap[0].data;
  }

  /**
   * Obtiene la prioridad del elemento con mayor prioridad
   * @returns {number} - La prioridad más alta o null si está vacía
   */
  peekPriority() {
    return this.isEmpty() ? null : this.heap[0].priority;
  }

  /**
   * Verifica si la cola está vacía
   * @returns {boolean}
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Obtiene el tamaño de la cola
   * @returns {number}
   */
  size() {
    return this.heap.length;
  }

  /**
   * Limpia la cola
   */
  clear() {
    this.heap = [];
  }

  /**
   * Convierte la cola a array ordenado por prioridad
   * @returns {Array}
   */
  toArray() {
    return this.heap
      .slice()
      .sort((a, b) => this.compare(a, b))
      .map(node => ({ data: node.data, priority: node.priority }));
  }

  /**
   * Obtiene todos los elementos con una prioridad específica
   * @param {number} priority 
   * @returns {Array}
   */
  getByPriority(priority) {
    return this.heap
      .filter(node => node.priority === priority)
      .map(node => node.data);
  }
}

/**
 * Cola de prioridad específica para casos COVID
 * Prioridades: death = 3, confirmed = 2, recovered = 1
 */
class CovidPriorityQueue extends PriorityQueue {
  constructor() {
    // Max-heap: deaths tienen mayor prioridad
    super((a, b) => b.priority - a.priority);
    this.priorityMap = {
      'death': 3,
      'confirmed': 2,
      'recovered': 1
    };
  }

  /**
   * Agrega un caso COVID con prioridad automática
   * @param {Object} record - Registro COVID
   */
  addCase(record) {
    if (!record || !record.type) return false;
    
    const priority = this.priorityMap[record.type.toLowerCase()] || 1;
    const enrichedRecord = {
      ...record,
      addedAt: new Date().toISOString(),
      priorityLevel: this._getPriorityName(priority)
    };
    
    this.enqueue(enrichedRecord, priority);
    return true;
  }

  /**
   * Obtiene los casos más críticos
   * @param {number} count - Número de casos a obtener
   * @returns {Array}
   */
  getMostCritical(count = 10) {
    const critical = [];
    const tempQueue = new CovidPriorityQueue();
    
    // Extraer elementos y guardar en cola temporal
    while (!this.isEmpty() && critical.length < count) {
      const case_ = this.dequeue();
      critical.push(case_);
      tempQueue.addCase(case_);
    }
    
    // Restaurar elementos a la cola original
    while (!tempQueue.isEmpty()) {
      const case_ = tempQueue.dequeue();
      this.addCase(case_);
    }
    
    return critical;
  }

  /**
   * Obtiene estadísticas de la cola
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.size(),
      deaths: 0,
      confirmed: 0,
      recovered: 0,
      countries: new Set(),
      dateRange: { earliest: null, latest: null }
    };
    
    for (const node of this.heap) {
      const record = node.data;
      const type = record.type?.toLowerCase();
      
      if (type === 'death') stats.deaths++;
      else if (type === 'confirmed') stats.confirmed++;
      else if (type === 'recovered') stats.recovered++;
      
      if (record.country) {
        stats.countries.add(record.country);
      }
      
      if (record.date) {
        if (!stats.dateRange.earliest || record.date < stats.dateRange.earliest) {
          stats.dateRange.earliest = record.date;
        }
        if (!stats.dateRange.latest || record.date > stats.dateRange.latest) {
          stats.dateRange.latest = record.date;
        }
      }
    }
    
    stats.countries = stats.countries.size;
    return stats;
  }

  /**
   * Obtiene casos por país ordenados por prioridad
   * @param {string} country 
   * @returns {Array}
   */
  getCasesByCountry(country) {
    if (!country) return [];
    
    return this.heap
      .filter(node => node.data.country?.toLowerCase() === country.toLowerCase())
      .sort((a, b) => this.compare(a, b))
      .map(node => node.data);
  }

  _getPriorityName(priority) {
    const names = { 3: 'Critical', 2: 'High', 1: 'Normal' };
    return names[priority] || 'Unknown';
  }
}

module.exports = { 
  PriorityQueue, 
  PriorityQueueNode, 
  CovidPriorityQueue 
};