// backend/hashIndex.js
// Tabla Hash sencilla con separate chaining + rehash automático

class HashIndex {
  constructor(initialCapacity = 2048) {
    this._buckets = Array.from({ length: initialCapacity }, () => []);
    this._keys = 0;
  }

  _hash(key) {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % this._buckets.length;
  }

  _loadFactor() {
    return this._keys / this._buckets.length;
  }

  _rehash(newCapacity) {
    const old = this._buckets;
    this._buckets = Array.from({ length: newCapacity }, () => []);
    this._keys = 0;
    for (const bucket of old) {
      for (const entry of bucket) {
        for (const v of entry.values) this.add(entry.key, v);
      }
    }
  }

  add(rawKey, value) {
    const key = String(rawKey);
    const i = this._hash(key);
    const bucket = this._buckets[i];

    let entry = bucket.find(e => e.key === key);
    if (!entry) {
      entry = { key, values: [] };
      bucket.push(entry);
      this._keys++;
      if (this._loadFactor() > 0.75) this._rehash(this._buckets.length * 2);
    }
    entry.values.push(value);
  }

  find(rawKey) {
    const key = String(rawKey);
    const i = this._hash(key);
    const bucket = this._buckets[i];
    const entry = bucket.find(e => e.key === key);
    return entry ? entry.values.slice() : [];
  }

  size() {
    return this._keys;
  }

  clear() {
    for (let i = 0; i < this._buckets.length; i++) this._buckets[i] = [];
    this._keys = 0;
  }
}

module.exports = { HashIndex };
