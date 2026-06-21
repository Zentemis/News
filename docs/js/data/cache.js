/* ============================================================
   CACHE — IndexedDB wrapper using idb-keyval-style API
   Persistent key-value storage with TTL expiration
   ============================================================ */

const DB_NAME = 'meridian-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function get(key) {
  const d = await openDB();
  return new Promise((resolve) => {
    const tx = d.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => {
      const entry = req.result;
      if (!entry) return resolve(null);
      if (entry.ttl && Date.now() > entry.ttl) {
        remove(key);
        return resolve(null);
      }
      resolve(entry.data);
    };
    req.onerror = () => resolve(null);
  });
}

export async function set(key, data, ttlMs = null) {
  const d = await openDB();
  const entry = {
    data,
    ts: Date.now(),
    ttl: ttlMs ? Date.now() + ttlMs : null
  };
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function remove(key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function keys() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}