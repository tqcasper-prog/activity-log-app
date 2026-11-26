'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('../public/storage.js');

function fakeIndexedDB() {
  const values = new Map();
  return {
    values,
    open() {
      const request = {};
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: name => name === 'app-state' },
          createObjectStore() {},
          close() {},
          transaction() {
            const tx = {
              objectStore() {
                return {
                  get(key) {
                    const req = {};
                    queueMicrotask(() => { req.result = values.get(key); req.onsuccess?.(); });
                    return req;
                  },
                  put(value, key) {
                    values.set(key, structuredClone(value));
                    return {};
                  }
                };
              }
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          }
        };
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

function fakeLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    values
  };
}

const sample = () => ({
  version: 2,
  activities: [{ id: 'a1', title: 'ออกกำลังกาย' }],
  timeLogs: [], meals: [], workouts: [], measurements: [],
  coachMessages: [{ role: 'user', text: 'ทดสอบ' }],
  workoutPlans: [], targets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  preferences: { timezone: 'Asia/Bangkok', weekStartsOn: 1, units: 'metric' }
});

test('migrates existing localStorage data to IndexedDB without deleting the original', async () => {
  const original = JSON.stringify(sample());
  const local = fakeLocalStorage({ lhp_v2: original });
  const idb = fakeIndexedDB();
  const storage = createStorage({ indexedDB: idb, localStorage: local });

  const loaded = await storage.load('lhp_v2');

  assert.equal(loaded.source, 'indexeddb');
  assert.equal(loaded.migrated, true);
  assert.deepEqual(loaded.data, sample());
  assert.equal(local.getItem('lhp_v2'), original);
  assert.deepEqual(idb.values.get('lhp_v2'), sample());
});

test('saves large structured planner data to IndexedDB without writing localStorage', async () => {
  const local = fakeLocalStorage();
  const idb = fakeIndexedDB();
  const storage = createStorage({ indexedDB: idb, localStorage: local });
  const data = sample();
  data.coachMessages = Array.from({ length: 16 }, (_, i) => ({ role: 'assistant', text: 'คำแนะนำ'.repeat(200) + i }));

  const result = await storage.save(data);

  assert.equal(result.source, 'indexeddb');
  assert.equal(result.fallback, false);
  assert.equal(idb.values.get('lhp_v2').coachMessages.length, 16);
  assert.equal(local.getItem('lhp_v2'), null);
});

test('falls back to localStorage when IndexedDB is unavailable', async () => {
  const local = fakeLocalStorage();
  const storage = createStorage({ indexedDB: null, localStorage: local });

  const result = await storage.save(sample());

  assert.equal(result.source, 'localstorage');
  assert.equal(result.fallback, true);
  assert.deepEqual(JSON.parse(local.getItem('lhp_v2')), sample());
});
