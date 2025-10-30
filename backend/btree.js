// backend/btree.js
// Implementación de BTree para búsquedas eficientes por rangos de fechas

class BTreeNode {
  constructor(degree, isLeaf = false) {
    this.degree = degree; // Grado mínimo del árbol
    this.keys = []; // Array de claves (fechas)
    this.values = []; // Array de valores (registros) - solo para hojas
    this.children = []; // Array de nodos hijos
    this.isLeaf = isLeaf;
    this.next = null; // Para enlazar hojas (B+ Tree)
  }

  /**
   * Busca la posición donde debería insertar una clave
   * @param {string} key - La clave a buscar
   * @returns {number}
   */
  findInsertPosition(key) {
    let i = 0;
    while (i < this.keys.length && key > this.keys[i]) {
      i++;
    }
    return i;
  }

  /**
   * Verifica si el nodo está lleno
   * @returns {boolean}
   */
  isFull() {
    return this.keys.length >= 2 * this.degree - 1;
  }

  /**
   * Divide un nodo hijo lleno
   * @param {number} index - Índice del hijo a dividir
   */
  splitChild(index) {
    const fullChild = this.children[index];
    const newChild = new BTreeNode(fullChild.degree, fullChild.isLeaf);
    
    const midIndex = this.degree - 1;
    
    // Mover la mitad de las claves al nuevo nodo
    newChild.keys = fullChild.keys.splice(midIndex + 1);
    
    if (fullChild.isLeaf) {
      // En B+ tree, las hojas mantienen todas las claves
      newChild.values = fullChild.values.splice(midIndex + 1);
      newChild.next = fullChild.next;
      fullChild.next = newChild;
    } else {
      // Mover los hijos también
      newChild.children = fullChild.children.splice(midIndex + 1);
    }
    
    // Promover la clave media al padre
    const promotedKey = fullChild.keys.splice(midIndex, 1)[0];
    
    // Insertar la nueva clave y el nuevo hijo en el padre
    this.keys.splice(index, 0, promotedKey);
    this.children.splice(index + 1, 0, newChild);
  }
}

class BTree {
  constructor(degree = 3) {
    this.root = new BTreeNode(degree, true);
    this.degree = degree;
    this.size = 0;
  }

  /**
   * Inserta una clave-valor en el árbol
   * @param {string} key - La clave (fecha)
   * @param {Object} value - El valor (registro)
   */
  insert(key, value) {
    if (!key || !value) return;

    // Si la raíz está llena, crear una nueva raíz
    if (this.root.isFull()) {
      const newRoot = new BTreeNode(this.degree, false);
      newRoot.children.push(this.root);
      newRoot.splitChild(0);
      this.root = newRoot;
    }

    this._insertNonFull(this.root, key, value);
    this.size++;
  }

  /**
   * Busca todos los valores para una clave específica
   * @param {string} key - La clave a buscar
   * @returns {Array}
   */
  search(key) {
    return this._searchNode(this.root, key);
  }

  /**
   * Busca todos los valores en un rango de claves
   * @param {string} startKey - Clave inicial (inclusive)
   * @param {string} endKey - Clave final (inclusive)
   * @returns {Array}
   */
  rangeSearch(startKey, endKey) {
    if (startKey > endKey) return [];

    const results = [];
    const startLeaf = this._findLeafNode(startKey);
    
    if (!startLeaf) return results;

    let currentLeaf = startLeaf;
    
    while (currentLeaf) {
      for (let i = 0; i < currentLeaf.keys.length; i++) {
        const key = currentLeaf.keys[i];
        
        if (key >= startKey && key <= endKey) {
          // En B+ tree, los valores están solo en las hojas
          if (currentLeaf.values && currentLeaf.values[i]) {
            if (Array.isArray(currentLeaf.values[i])) {
              results.push(...currentLeaf.values[i]);
            } else {
              results.push(currentLeaf.values[i]);
            }
          }
        }
        
        if (key > endKey) {
          return results;
        }
      }
      
      currentLeaf = currentLeaf.next;
    }
    
    return results;
  }

  /**
   * Obtiene todas las claves únicas en el árbol
   * @returns {Array<string>}
   */
  getAllKeys() {
    const keys = new Set();
    this._collectKeys(this.root, keys);
    return Array.from(keys).sort();
  }

  /**
   * Obtiene estadísticas del árbol
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.size,
      degree: this.degree,
      height: this._getHeight(this.root),
      leafNodes: this._countLeafNodes(this.root),
      totalNodes: this._countTotalNodes(this.root)
    };
  }

  /**
   * Limpia el árbol
   */
  clear() {
    this.root = new BTreeNode(this.degree, true);
    this.size = 0;
  }

  // Métodos privados

  _insertNonFull(node, key, value) {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      // Insertar en hoja
      const insertPos = node.findInsertPosition(key);
      
      if (insertPos < node.keys.length && node.keys[insertPos] === key) {
        // La clave ya existe, agregar el valor
        if (!node.values[insertPos]) {
          node.values[insertPos] = [];
        }
        if (!Array.isArray(node.values[insertPos])) {
          node.values[insertPos] = [node.values[insertPos]];
        }
        node.values[insertPos].push(value);
      } else {
        // Nueva clave
        node.keys.splice(insertPos, 0, key);
        node.values.splice(insertPos, 0, [value]);
      }
    } else {
      // Encontrar el hijo correcto
      while (i >= 0 && key < node.keys[i]) {
        i--;
      }
      i++;

      // Si el hijo está lleno, dividirlo
      if (node.children[i].isFull()) {
        node.splitChild(i);
        if (key > node.keys[i]) {
          i++;
        }
      }

      this._insertNonFull(node.children[i], key, value);
    }
  }

  _searchNode(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) {
      i++;
    }

    if (i < node.keys.length && key === node.keys[i]) {
      if (node.isLeaf && node.values && node.values[i]) {
        return Array.isArray(node.values[i]) ? node.values[i] : [node.values[i]];
      }
    }

    if (node.isLeaf) {
      return [];
    }

    return this._searchNode(node.children[i], key);
  }

  _findLeafNode(key) {
    let current = this.root;
    
    while (!current.isLeaf) {
      let i = 0;
      while (i < current.keys.length && key > current.keys[i]) {
        i++;
      }
      current = current.children[i];
    }
    
    return current;
  }

  _collectKeys(node, keys) {
    for (const key of node.keys) {
      keys.add(key);
    }
    
    if (!node.isLeaf) {
      for (const child of node.children) {
        this._collectKeys(child, keys);
      }
    }
  }

  _getHeight(node) {
    if (node.isLeaf) return 1;
    return 1 + Math.max(...node.children.map(child => this._getHeight(child)));
  }

  _countLeafNodes(node) {
    if (node.isLeaf) return 1;
    return node.children.reduce((count, child) => count + this._countLeafNodes(child), 0);
  }

  _countTotalNodes(node) {
    if (node.isLeaf) return 1;
    return 1 + node.children.reduce((count, child) => count + this._countTotalNodes(child), 0);
  }
}

module.exports = { BTree, BTreeNode };