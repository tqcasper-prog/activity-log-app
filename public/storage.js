(function (root) {
  'use strict';
  const DB_NAME = 'life-health-planner';
  const DB_VERSION = 1;
  const STORE_NAME = 'app-state';

  function createStorage(options = {}) {
    const idb = options.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    const local = options.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    let dbPromise;

    function openDatabase() {
      if (!idb) return Promise.reject(new Error('IndexedDB is not available'));
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        let request;
        try { request = idb.open(DB_NAME, DB_VERSION); }
        catch (error) { reject(error); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
        request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
      }).catch(error => {
        dbPromise = null;
        throw error;
      });
      return dbPromise;
    }

    function requestResult(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
      });
    }

    async function readFromDatabase(key) {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, 'readonly');
      return requestResult(tx.objectStore(STORE_NAME).get(key));
    }

    async function writeToDatabase(key, value) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
      });
    }

    function readLegacy(key) {
      if (!local) return null;
      try {
        const value = JSON.parse(local.getItem(key));
        return value && value.version === 2 ? value : null;
      } catch { return null; }
    }

    return {
      async load(key) {
        try {
          const saved = await readFromDatabase(key);
          if (saved && saved.version === 2) return { data: saved, source: 'indexeddb', migrated: false };
          const legacy = readLegacy(key);
          if (legacy) {
            await writeToDatabase(key, legacy);
            return { data: legacy, source: 'indexeddb', migrated: true };
          }
          return { data: null, source: 'indexeddb', migrated: false };
        } catch (error) {
          const legacy = readLegacy(key);
          if (legacy) return { data: legacy, source: 'localstorage', migrated: false, warning: error.message };
          throw error;
        }
      },
      async save(value) {
        const snapshot = JSON.parse(JSON.stringify(value));
        try {
          await writeToDatabase('lhp_v2', snapshot);
          return { source: 'indexeddb', fallback: false };
        } catch (error) {
          if (local) {
            try {
              local.setItem('lhp_v2', JSON.stringify(snapshot));
              return { source: 'localstorage', fallback: true, warning: error.message };
            } catch (fallbackError) {
              fallbackError.cause = error;
              throw fallbackError;
            }
          }
          throw error;
        }
      }
    };
  }

  const api = createStorage();
  root.LHPStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createStorage };
})(typeof window !== 'undefined' ? window : globalThis);
