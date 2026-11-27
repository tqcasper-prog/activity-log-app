const test = require('node:test');
const assert = require('node:assert/strict');
const evidence = require('../data/exercise-evidence.json');

test('evidence library has a version, review date, and unique source identifiers', () => {
  assert.match(evidence.version, /^\\d{4}-\\d{2}-\\d+\\.\\d+$/);
  assert.match(evidence.reviewedOn, /^\\d{4}-\\d{2}-\\d{2}$/);
  const ids = evidence.sources.map(source => source.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(evidence.sources.every(source => source.title && source.organization && source.year && /^https:\\/\\//.test(source.url)));
});

test('every principle and exercise cites only known evidence sources', () => {
  const sourceIds = new Set(evidence.sources.map(source => source.id));
  for (const item of [...evidence.principles, ...evidence.exercises]) {
    assert.ok(item.id && item.title !== '');
    assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
    for (const sourceId of item.sourceIds) assert.ok(sourceIds.has(sourceId), 'unknown source: ' + sourceId);
  }
});

test('exercise catalog identifiers are unique and no-equipment entries disclose coverage gaps', () => {
  const ids = evidence.exercises.map(exercise => exercise.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(evidence.exercises.length >= 6);
  assert.ok(evidence.exercises.every(exercise => exercise.name && exercise.steps.length >= 3 && exercise.caution));
  assert.ok(evidence.exercises.every(exercise => exercise.equipment.includes('ไม่มีอุปกรณ์')));
  assert.ok(evidence.coverageLimitations.some(note => note.includes('ท่าดึง')));
});
