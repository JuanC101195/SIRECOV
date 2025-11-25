// backend/btree.js
// Implementación completa de B+ Tree para búsquedas eficientes por rangos de fechas
// El B+ Tree es ideal para sistemas de bases de datos y consultas de rango
// ya que todos los datos están en las hojas enlazadas, permitiendo recorridos secuenciales eficientes

/**
 * Nodo del B+ Tree
 * Los nodos internos solo contienen claves para navegación
 * Los nodos hoja contienen claves y valores, y están enlazados entre sí
 */
class BTreeNode {
  constructor(degree, isLeaf = false) {
    this.degree = degree; // Grado mínimo del árbol (t)
    this.keys = []; // Array de claves ordenadas
    this.values = []; // Array de valores - solo en hojas
    this.children = []; // Array de punteros a hijos - solo en nodos internos
    this.isLeaf = isLeaf; // true si es nodo hoja
    this.next = null; // Puntero al siguiente nodo hoja (para recorridos secuenciales)
    this.parent = null; // Puntero al nodo padre (facilita operaciones)
  }

  /**
   * Encuentra la posición correcta para insertar una clave
   * Usa búsqueda binaria para mejor eficiencia
   * @param {string} key - La clave a buscar
   * @returns {number} Posición de inserción
   */
  findInsertPosition(key) {
    let left = 0;
    let right = this.keys.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.keys[mid] < key) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }

  /**
   * Encuentra el índice de una clave exacta
   * @param {string} key - La clave a buscar
   * @returns {number} Índice de la clave o -1 si no existe
   */
  findKeyIndex(key) {
    const pos = this.findInsertPosition(key);
    if (pos < this.keys.length && this.keys[pos] === key) {
      return pos;
    }
    return -1;
  }

  /**
   * Verifica si el nodo está lleno (alcanzó el máximo de claves)
   * Un nodo puede contener hasta 2t-1 claves
   * @returns {boolean}
   */
  isFull() {
    return this.keys.length >= 2 * this.degree - 1;
  }

  /**
   * Verifica si el nodo tiene el mínimo de claves requerido
   * Un nodo debe tener al menos t-1 claves (excepto la raíz)
   * @returns {boolean}
   */
  hasMinimumKeys() {
    return this.keys.length >= this.degree - 1;
  }

  /**
   * Verifica si el nodo puede prestar una clave
   * @returns {boolean}
   */
  canLendKey() {
    return this.keys.length > this.degree - 1;
  }

  /**
   * Divide un nodo hijo lleno en dos nodos
   * Operación fundamental del B+ Tree para mantener el balance
   * @param {number} index - Índice del hijo a dividir
   */
  splitChild(index) {
    const fullChild = this.children[index];
    const newChild = new BTreeNode(fullChild.degree, fullChild.isLeaf);
    newChild.parent = this;
    
    const midIndex = Math.floor(fullChild.keys.length / 2);
    
    if (fullChild.isLeaf) {
      // Para nodos hoja: copiar la clave media al padre (no mover)
      // y dividir las claves y valores
      newChild.keys = fullChild.keys.slice(midIndex);
      newChild.values = fullChild.values.slice(midIndex);
      fullChild.keys = fullChild.keys.slice(0, midIndex);
      fullChild.values = fullChild.values.slice(0, midIndex);
      
      // Mantener el enlace entre hojas
      newChild.next = fullChild.next;
      fullChild.next = newChild;
      
      // Promover una copia de la primera clave del nuevo nodo
      const promotedKey = newChild.keys[0];
      this.keys.splice(index, 0, promotedKey);
    } else {
      // Para nodos internos: mover la clave media al padre
      newChild.keys = fullChild.keys.slice(midIndex + 1);
      newChild.children = fullChild.children.slice(midIndex + 1);
      
      // Actualizar padres de los hijos movidos
      newChild.children.forEach(child => child.parent = newChild);
      
      const promotedKey = fullChild.keys[midIndex];
      fullChild.keys = fullChild.keys.slice(0, midIndex);
      fullChild.children = fullChild.children.slice(0, midIndex + 1);
      
      this.keys.splice(index, 0, promotedKey);
    }
    
    this.children.splice(index + 1, 0, newChild);
  }

  /**
   * Fusiona este nodo con su hermano derecho
   * @param {number} index - Índice en el padre
   */
  mergeWithRightSibling(index) {
    const rightSibling = this.parent.children[index + 1];
    const separatorKey = this.parent.keys[index];
    
    if (this.isLeaf) {
      // Para hojas, simplemente concatenar
      this.keys.push(...rightSibling.keys);
      this.values.push(...rightSibling.values);
      this.next = rightSibling.next;
    } else {
      // Para nodos internos, incluir la clave separadora
      this.keys.push(separatorKey, ...rightSibling.keys);
      this.children.push(...rightSibling.children);
      this.children.forEach(child => child.parent = this);
    }
    
    // Eliminar la clave separadora y el hermano del padre
    this.parent.keys.splice(index, 1);
    this.parent.children.splice(index + 1, 1);
  }

  /**
   * Toma prestada una clave del hermano izquierdo
   * @param {number} index - Índice en el padre
   */
  borrowFromLeftSibling(index) {
    const leftSibling = this.parent.children[index - 1];
    
    if (this.isLeaf) {
      // Mover la última clave del hermano izquierdo
      const borrowedKey = leftSibling.keys.pop();
      const borrowedValue = leftSibling.values.pop();
      
      this.keys.unshift(borrowedKey);
      this.values.unshift(borrowedValue);
      
      // Actualizar la clave en el padre
      this.parent.keys[index - 1] = this.keys[0];
    } else {
      // Rotar a través del padre
      this.keys.unshift(this.parent.keys[index - 1]);
      this.parent.keys[index - 1] = leftSibling.keys.pop();
      
      const borrowedChild = leftSibling.children.pop();
      borrowedChild.parent = this;
      this.children.unshift(borrowedChild);
    }
  }

  /**
   * Toma prestada una clave del hermano derecho
   * @param {number} index - Índice en el padre
   */
  borrowFromRightSibling(index) {
    const rightSibling = this.parent.children[index + 1];
    
    if (this.isLeaf) {
      // Mover la primera clave del hermano derecho
      const borrowedKey = rightSibling.keys.shift();
      const borrowedValue = rightSibling.values.shift();
      
      this.keys.push(borrowedKey);
      this.values.push(borrowedValue);
      
      // Actualizar la clave en el padre
      this.parent.keys[index] = rightSibling.keys[0];
    } else {
      // Rotar a través del padre
      this.keys.push(this.parent.keys[index]);
      this.parent.keys[index] = rightSibling.keys.shift();
      
      const borrowedChild = rightSibling.children.shift();
      borrowedChild.parent = this;
      this.children.push(borrowedChild);
    }
  }
}


/**
 * Clase B+ Tree
 * Árbol balanceado de búsqueda optimizado para sistemas que leen y escriben
 * grandes bloques de datos. Características principales:
 * - Todos los datos están en las hojas
 * - Las hojas están enlazadas para recorridos secuenciales eficientes
 * - Altamente eficiente para búsquedas por rango
 * - Auto-balanceo garantizado
 * - Complejidad O(log n) para búsqueda, inserción y eliminación
 */
class BTree {
  constructor(degree = 4) {
    if (degree < 2) {
      throw new Error('El grado del árbol debe ser al menos 2');
    }
    
    this.root = new BTreeNode(degree, true);
    this.degree = degree; // Grado mínimo (t)
    this.size = 0; // Número total de elementos
    this.height = 1; // Altura del árbol
  }

  /**
   * Inserta una clave-valor en el árbol
   * Si la clave ya existe, agrega el valor a la lista de valores
   * Complejidad: O(log n)
   * @param {string} key - La clave (fecha en formato YYYY-MM-DD)
   * @param {Object} value - El valor (registro COVID)
   */
  insert(key, value) {
    if (!key || value === undefined || value === null) {
      throw new Error('Clave y valor son requeridos');
    }

    // Si la raíz está llena, crear una nueva raíz y dividir
    if (this.root.isFull()) {
      const newRoot = new BTreeNode(this.degree, false);
      newRoot.children.push(this.root);
      this.root.parent = newRoot;
      newRoot.splitChild(0);
      this.root = newRoot;
      this.height++;
    }

    this._insertNonFull(this.root, key, value);
    this.size++;
  }

  /**
   * Busca todos los valores asociados a una clave específica
   * Complejidad: O(log n)
   * @param {string} key - La clave a buscar
   * @returns {Array} Array de valores asociados a la clave
   */
  search(key) {
    if (!key) return [];
    return this._searchNode(this.root, key);
  }

  /**
   * Busca todos los valores en un rango de claves [startKey, endKey]
   * Esta es la operación más poderosa del B+ Tree
   * Complejidad: O(log n + k) donde k es el número de elementos en el rango
   * @param {string} startKey - Clave inicial (inclusive)
   * @param {string} endKey - Clave final (inclusive)
   * @returns {Array} Array de todos los valores en el rango
   */
  rangeSearch(startKey, endKey) {
    if (!startKey || !endKey) return [];
    if (startKey > endKey) {
      [startKey, endKey] = [endKey, startKey]; // Intercambiar si están invertidos
    }

    const results = [];
    const startLeaf = this._findLeafNode(startKey);
    
    if (!startLeaf) return results;

    let currentLeaf = startLeaf;
    let collecting = false;
    
    // Recorrer las hojas enlazadas desde la hoja inicial
    while (currentLeaf) {
      for (let i = 0; i < currentLeaf.keys.length; i++) {
        const key = currentLeaf.keys[i];
        
        // Comenzar a recolectar cuando encontremos la clave inicial
        if (!collecting && key >= startKey) {
          collecting = true;
        }
        
        // Recolectar todos los valores en el rango
        if (collecting && key <= endKey) {
          if (currentLeaf.values && currentLeaf.values[i]) {
            const values = currentLeaf.values[i];
            if (Array.isArray(values)) {
              results.push(...values);
            } else {
              results.push(values);
            }
          }
        }
        
        // Detenerse si pasamos la clave final
        if (key > endKey) {
          return results;
        }
      }
      
      // Pasar a la siguiente hoja enlazada
      currentLeaf = currentLeaf.next;
    }
    
    return results;
  }

  /**
   * Elimina una clave y opcionalmente un valor específico del árbol
   * Complejidad: O(log n)
   * @param {string} key - La clave a eliminar
   * @param {Object} specificValue - Valor específico a eliminar (opcional)
   * @returns {boolean} true si se eliminó algo, false en caso contrario
   */
  delete(key, specificValue = null) {
    if (!key) return false;
    
    const deleted = this._delete(this.root, key, specificValue);
    
    // Si la raíz quedó vacía y no es hoja, promover su único hijo
    if (this.root.keys.length === 0 && !this.root.isLeaf) {
      if (this.root.children.length > 0) {
        this.root = this.root.children[0];
        this.root.parent = null;
        this.height--;
      }
    }
    
    if (deleted) {
      this.size--;
    }
    
    return deleted;
  }

  /**
   * Obtiene la primera clave (mínima) del árbol
   * @returns {string|null}
   */
  getMinKey() {
    if (this.size === 0) return null;
    
    let current = this.root;
    while (!current.isLeaf) {
      current = current.children[0];
    }
    
    return current.keys.length > 0 ? current.keys[0] : null;
  }

  /**
   * Obtiene la última clave (máxima) del árbol
   * @returns {string|null}
   */
  getMaxKey() {
    if (this.size === 0) return null;
    
    let current = this.root;
    while (!current.isLeaf) {
      current = current.children[current.children.length - 1];
    }
    
    return current.keys.length > 0 ? current.keys[current.keys.length - 1] : null;
  }

  /**
   * Obtiene todas las claves únicas en el árbol en orden
   * @returns {Array<string>}
   */
  getAllKeys() {
    const keys = [];
    let current = this._getFirstLeaf();
    
    while (current) {
      keys.push(...current.keys);
      current = current.next;
    }
    
    return keys;
  }

  /**
   * Obtiene todos los valores del árbol
   * @returns {Array}
   */
  getAllValues() {
    const values = [];
    let current = this._getFirstLeaf();
    
    while (current) {
      for (const valueSet of current.values) {
        if (Array.isArray(valueSet)) {
          values.push(...valueSet);
        } else {
          values.push(valueSet);
        }
      }
      current = current.next;
    }
    
    return values;
  }

  /**
   * Cuenta cuántos valores están asociados con una clave
   * @param {string} key
   * @returns {number}
   */
  countValues(key) {
    const values = this.search(key);
    return values.length;
  }

  /**
   * Verifica si una clave existe en el árbol
   * @param {string} key
   * @returns {boolean}
   */
  contains(key) {
    return this.search(key).length > 0;
  }

  /**
   * Obtiene estadísticas detalladas del árbol
   * @returns {Object} Objeto con métricas del árbol
   */
  getStats() {
    const stats = {
      size: this.size,
      degree: this.degree,
      height: this.height,
      uniqueKeys: 0,
      leafNodes: 0,
      internalNodes: 0,
      totalNodes: 0,
      minKey: this.getMinKey(),
      maxKey: this.getMaxKey(),
      averageKeysPerNode: 0,
      fillFactor: 0
    };
    
    const nodeStats = this._collectNodeStats(this.root);
    Object.assign(stats, nodeStats);
    
    if (stats.totalNodes > 0) {
      stats.averageKeysPerNode = stats.totalKeys / stats.totalNodes;
      const maxPossibleKeys = stats.totalNodes * (2 * this.degree - 1);
      stats.fillFactor = (stats.totalKeys / maxPossibleKeys * 100).toFixed(2) + '%';
    }
    
    return stats;
  }

  /**
   * Limpia completamente el árbol
   */
  clear() {
    this.root = new BTreeNode(this.degree, true);
    this.size = 0;
    this.height = 1;
  }

  /**
   * Valida la integridad del árbol (útil para debugging)
   * @returns {Object} Resultado de validación
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    try {
      this._validateNode(this.root, null, null, errors, warnings);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        message: errors.length === 0 ? 'Árbol válido' : 'Árbol inválido'
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        warnings,
        message: 'Error durante validación'
      };
    }
  }

  /**
   * Convierte el árbol a una representación visual en texto
   * @returns {string}
   */
  toString() {
    const lines = [];
    this._buildTreeString(this.root, '', true, lines);
    return lines.join('\n');
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Inserta en un nodo que no está lleno
   * @private
   */
  _insertNonFull(node, key, value) {
    if (node.isLeaf) {
      // Insertar en nodo hoja
      const pos = node.findInsertPosition(key);
      
      if (pos < node.keys.length && node.keys[pos] === key) {
        // La clave ya existe, agregar el valor a la lista
        if (!node.values[pos]) {
          node.values[pos] = [];
        }
        if (!Array.isArray(node.values[pos])) {
          node.values[pos] = [node.values[pos]];
        }
        node.values[pos].push(value);
      } else {
        // Nueva clave, insertar
        node.keys.splice(pos, 0, key);
        node.values.splice(pos, 0, [value]);
      }
    } else {
      // Encontrar el hijo apropiado
      const pos = node.findInsertPosition(key);
      let childIndex = pos < node.keys.length && key >= node.keys[pos] ? pos + 1 : pos;

      // Si el hijo está lleno, dividirlo primero
      if (node.children[childIndex] && node.children[childIndex].isFull()) {
        node.splitChild(childIndex);
        // Después de dividir, determinar a qué hijo ir
        if (key > node.keys[childIndex]) {
          childIndex++;
        }
      }

      this._insertNonFull(node.children[childIndex], key, value);
    }
  }

  /**
   * Busca recursivamente en el árbol
   * @private
   */
  _searchNode(node, key) {
    const pos = node.findInsertPosition(key);

    // Si encontramos la clave exacta en un nodo hoja
    if (node.isLeaf) {
      if (pos < node.keys.length && node.keys[pos] === key) {
        const values = node.values[pos];
        return Array.isArray(values) ? values : [values];
      }
      return [];
    }

    // Buscar en el hijo apropiado
    const childIndex = pos < node.keys.length && key >= node.keys[pos] ? pos + 1 : pos;
    return this._searchNode(node.children[childIndex], key);
  }

  /**
   * Encuentra el nodo hoja que contiene o debería contener la clave
   * @private
   */
  _findLeafNode(key) {
    let current = this.root;
    
    while (!current.isLeaf) {
      const pos = current.findInsertPosition(key);
      const childIndex = pos < current.keys.length && key >= current.keys[pos] ? pos + 1 : pos;
      current = current.children[childIndex];
    }
    
    return current;
  }

  /**
   * Obtiene el primer nodo hoja (más a la izquierda)
   * @private
   */
  _getFirstLeaf() {
    let current = this.root;
    while (!current.isLeaf) {
      current = current.children[0];
    }
    return current;
  }

  /**
   * Elimina una clave del árbol
   * @private
   */
  _delete(node, key, specificValue) {
    const pos = node.findKeyIndex(key);
    
    if (node.isLeaf) {
      if (pos !== -1) {
        // Clave encontrada en hoja
        if (specificValue) {
          // Eliminar solo el valor específico
          const values = node.values[pos];
          if (Array.isArray(values)) {
            const index = values.findIndex(v => 
              JSON.stringify(v) === JSON.stringify(specificValue)
            );
            if (index !== -1) {
              values.splice(index, 1);
              if (values.length === 0) {
                node.keys.splice(pos, 1);
                node.values.splice(pos, 1);
              }
              return true;
            }
          }
          return false;
        } else {
          // Eliminar toda la clave
          node.keys.splice(pos, 1);
          node.values.splice(pos, 1);
          return true;
        }
      }
      return false;
    }
    
    // Nodo interno: navegar al hijo apropiado
    const childPos = pos !== -1 ? pos + 1 : node.findInsertPosition(key);
    const child = node.children[childPos];
    
    const deleted = this._delete(child, key, specificValue);
    
    // Rebalancear si es necesario
    if (deleted && !child.hasMinimumKeys() && child !== this.root) {
      this._rebalance(node, childPos);
    }
    
    return deleted;
  }

  /**
   * Rebalancea el árbol después de una eliminación
   * @private
   */
  _rebalance(parent, childIndex) {
    const child = parent.children[childIndex];
    
    // Intentar pedir prestado del hermano izquierdo
    if (childIndex > 0 && parent.children[childIndex - 1].canLendKey()) {
      child.borrowFromLeftSibling(childIndex);
      return;
    }
    
    // Intentar pedir prestado del hermano derecho
    if (childIndex < parent.children.length - 1 && 
        parent.children[childIndex + 1].canLendKey()) {
      child.borrowFromRightSibling(childIndex);
      return;
    }
    
    // No se puede pedir prestado, fusionar con un hermano
    if (childIndex > 0) {
      parent.children[childIndex - 1].mergeWithRightSibling(childIndex - 1);
    } else {
      child.mergeWithRightSibling(childIndex);
    }
  }

  /**
   * Recolecta estadísticas de los nodos
   * @private
   */
  _collectNodeStats(node) {
    const stats = {
      leafNodes: 0,
      internalNodes: 0,
      totalNodes: 1,
      totalKeys: node.keys.length,
      uniqueKeys: 0
    };
    
    if (node.isLeaf) {
      stats.leafNodes = 1;
      stats.uniqueKeys = node.keys.length;
    } else {
      stats.internalNodes = 1;
      for (const child of node.children) {
        const childStats = this._collectNodeStats(child);
        stats.leafNodes += childStats.leafNodes;
        stats.internalNodes += childStats.internalNodes;
        stats.totalNodes += childStats.totalNodes;
        stats.totalKeys += childStats.totalKeys;
        stats.uniqueKeys += childStats.uniqueKeys;
      }
    }
    
    return stats;
  }

  /**
   * Valida un nodo recursivamente
   * @private
   */
  _validateNode(node, minKey, maxKey, errors, warnings) {
    // Validar orden de claves
    for (let i = 1; i < node.keys.length; i++) {
      if (node.keys[i] <= node.keys[i - 1]) {
        errors.push(`Claves desordenadas en nodo: ${node.keys[i - 1]} >= ${node.keys[i]}`);
      }
    }
    
    // Validar límites
    if (minKey !== null && node.keys.length > 0 && node.keys[0] < minKey) {
      errors.push(`Clave ${node.keys[0]} es menor que el mínimo ${minKey}`);
    }
    if (maxKey !== null && node.keys.length > 0 && 
        node.keys[node.keys.length - 1] > maxKey) {
      errors.push(`Clave ${node.keys[node.keys.length - 1]} es mayor que el máximo ${maxKey}`);
    }
    
    // Validar número de claves
    if (node !== this.root && node.keys.length < this.degree - 1) {
      warnings.push(`Nodo tiene menos claves del mínimo: ${node.keys.length}`);
    }
    if (node.keys.length > 2 * this.degree - 1) {
      errors.push(`Nodo tiene más claves del máximo: ${node.keys.length}`);
    }
    
    // Validar hijos
    if (!node.isLeaf) {
      if (node.children.length !== node.keys.length + 1) {
        errors.push(`Número incorrecto de hijos: ${node.children.length} para ${node.keys.length} claves`);
      }
      
      for (let i = 0; i < node.children.length; i++) {
        const childMinKey = i > 0 ? node.keys[i - 1] : minKey;
        const childMaxKey = i < node.keys.length ? node.keys[i] : maxKey;
        this._validateNode(node.children[i], childMinKey, childMaxKey, errors, warnings);
      }
    }
  }

  /**
   * Construye representación en string del árbol
   * @private
   */
  _buildTreeString(node, prefix, isLast, lines) {
    const connector = isLast ? '└── ' : '├── ';
    const nodeType = node.isLeaf ? '🍃' : '🌿';
    lines.push(prefix + connector + nodeType + ' [' + node.keys.join(', ') + ']');
    
    if (!node.isLeaf) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < node.children.length; i++) {
        const isLastChild = i === node.children.length - 1;
        this._buildTreeString(node.children[i], newPrefix, isLastChild, lines);
      }
    }
  }
}

module.exports = { BTree, BTreeNode };