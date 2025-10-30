// backend/trie.js
// Estructura Trie para autocompletado rápido de países

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.frequency = 0; // Para ordenar por popularidad
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
    this.size = 0;
  }

  /**
   * Inserta una palabra en el Trie
   * @param {string} word - La palabra a insertar
   */
  insert(word) {
    if (!word || typeof word !== 'string') return;
    
    const normalizedWord = word.toLowerCase().trim();
    if (!normalizedWord) return;

    let current = this.root;
    
    for (const char of normalizedWord) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
    }
    
    if (!current.isEndOfWord) {
      current.isEndOfWord = true;
      this.size++;
    }
    current.frequency++;
  }

  /**
   * Busca si una palabra existe en el Trie
   * @param {string} word - La palabra a buscar
   * @returns {boolean}
   */
  search(word) {
    if (!word || typeof word !== 'string') return false;
    
    const normalizedWord = word.toLowerCase().trim();
    const node = this._findNode(normalizedWord);
    return node !== null && node.isEndOfWord;
  }

  /**
   * Encuentra todas las palabras que empiezan con el prefijo dado
   * @param {string} prefix - El prefijo a buscar
   * @param {number} limit - Límite de resultados (default: 10)
   * @returns {Array<{word: string, frequency: number}>}
   */
  autocomplete(prefix, limit = 10) {
    if (!prefix || typeof prefix !== 'string') return [];
    
    const normalizedPrefix = prefix.toLowerCase().trim();
    if (!normalizedPrefix) return this._getAllWords(limit);
    
    const prefixNode = this._findNode(normalizedPrefix);
    if (!prefixNode) return [];
    
    const results = [];
    this._collectWords(prefixNode, normalizedPrefix, results);
    
    // Ordenar por frecuencia (descendente) y luego alfabéticamente
    results.sort((a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      return a.word.localeCompare(b.word);
    });
    
    return results.slice(0, limit);
  }

  /**
   * Obtiene estadísticas del Trie
   * @returns {Object}
   */
  getStats() {
    return {
      totalWords: this.size,
      nodes: this._countNodes(this.root),
      averageDepth: this._getAverageDepth()
    };
  }

  /**
   * Limpia el Trie
   */
  clear() {
    this.root = new TrieNode();
    this.size = 0;
  }

  // Métodos privados

  _findNode(word) {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        return null;
      }
      current = current.children.get(char);
    }
    return current;
  }

  _collectWords(node, prefix, results) {
    if (node.isEndOfWord) {
      results.push({
        word: prefix,
        frequency: node.frequency
      });
    }

    for (const [char, childNode] of node.children) {
      this._collectWords(childNode, prefix + char, results);
    }
  }

  _getAllWords(limit) {
    const results = [];
    this._collectWords(this.root, '', results);
    
    results.sort((a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      return a.word.localeCompare(b.word);
    });
    
    return results.slice(0, limit);
  }

  _countNodes(node) {
    let count = 1;
    for (const child of node.children.values()) {
      count += this._countNodes(child);
    }
    return count;
  }

  _getAverageDepth() {
    if (this.size === 0) return 0;
    
    const depths = [];
    this._collectDepths(this.root, 0, depths);
    
    const sum = depths.reduce((acc, depth) => acc + depth, 0);
    return sum / depths.length;
  }

  _collectDepths(node, currentDepth, depths) {
    if (node.isEndOfWord) {
      depths.push(currentDepth);
    }
    
    for (const child of node.children.values()) {
      this._collectDepths(child, currentDepth + 1, depths);
    }
  }
}

module.exports = { Trie, TrieNode };