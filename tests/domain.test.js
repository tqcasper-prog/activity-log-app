'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../public/domain.js');

test('date ranges use Monday through Sunday and real calendar boundaries', () => {
  assert.deepEqual(d.dateRange('2026-11-26', 'week'), { start: '2026-11-23', end: '2026-11-29' });
  assert.deepEqual(d.dateRange('2024-02-15', 'month'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(d.dateRange('2026-06-01', 'year'), { start: '2026-01-01', end: '2026-12-31' });
});

test('rejects impossible calendar dates', () => {
  assert.throws(() => d.parseDate('2026-02-30'), /วันที่ไม่มีอยู่จริง/);
});

test('calculates same-day and overnight duration', () => {
  assert.equal(d.minutesBetween('19:20', '20:10'), 50);
  assert.equal(d.minutesBetween('22:00', '06:30'), 510);
  assert.throws(() => d.minutesBetween('25:00', '26:00'));
});

test('validates activities and detects overlapping time blocks', () => {
  const a = d.validateActivity({ id: 'a', title: 'ออกกำลังกาย', date: '2026-11-26', start: '19:00', end: '20:00' });
  const b = { id: 'b', date: '2026-11-26', start: '19:45', end: '20:15' };
  assert.equal(a.durationMinutes, 60);
  assert.equal(d.findOverlaps(a, [b]).length, 1);
  assert.equal(d.findOverlaps(a, [{ ...b, date: '2026-11-27' }]).length, 0);
});

test('aggregates only logs inside selected date range', () => {
  const result = d.sumTimeLogs([
    { date: '2026-11-23', category: 'งาน', durationMinutes: 120 },
    { date: '2026-11-24', category: 'เรียน', durationMinutes: 45 },
    { date: '2026-11-30', category: 'งาน', durationMinutes: 60 }
  ], { start: '2026-11-23', end: '2026-11-29' });
  assert.equal(result.minutes, 165);
  assert.equal(result.byCategory['งาน'], 120);
  assert.equal(result.count, 2);
});

test('sums daily nutrition and validates BMI inputs', () => {
  const result = d.sumNutrition([
    { date: '2026-11-26', calories: 500, protein: 30, carbs: 50, fat: 15 },
    { date: '2026-11-25', calories: 900, protein: 40, carbs: 80, fat: 20 }
  ], '2026-11-26');
  assert.equal(result.calories, 500);
  assert.equal(result.protein, 30);
  assert.equal(d.bmi(54, 178), 54 / (1.78 ** 2));
  assert.equal(d.bmi(0, 178), null);
});

test('migrates legacy entries without deleting or overwriting source records', () => {
  const migrated = d.migrateLegacy({
    activities: [{ name: 'อ่านหนังสือ', time: '20:00–21:00', day: 'จันทร์' }],
    logs: [{ detail: 'อ่าน', hours: 1.5, category: 'เรียน' }],
    foods: [{ name: 'ไข่', cal: 150, protein: 12, carb: 1, fat: 10 }]
  });
  assert.equal(migrated.activities[0].start, '20:00');
  assert.equal(migrated.activities[0].end, '21:00');
  assert.equal(migrated.logs[0].durationMinutes, 90);
  assert.equal(migrated.meals[0].calories, 150);
});


test('workout coach recommends different muscles after recent push exercise', () => {
  const result = d.recommendWorkout({
    date: '2026-11-26',
    text: 'เมื่อวานวิดพื้น 2 เซ็ต',
    workouts: [{ date: '2026-11-25', exercise: 'วิดพื้นแบบพิงกำแพง', effort: 'พอดี' }]
  });
  assert.equal(result.status, 'train');
  assert.ok(result.suggestions.every(item => !/วิดพื้น/.test(item.name)));
  assert.match(result.reason, /หลีกเลี่ยงส่วน/);
});

test('workout coach recommends recovery when the user reports pain', () => {
  const result = d.recommendWorkout({ date: '2026-11-26', text: 'วันนี้เจ็บหัวเข่า' });
  assert.equal(result.status, 'rest');
  assert.equal(result.suggestions.length, 0);
});

test('workout coach recommends recovery after a full-body workout', () => {
  const result = d.recommendWorkout({
    date: '2026-11-26',
    workouts: [{ date: '2026-11-25', exercise: 'ฝึกทั้งตัว full body' }]
  });
  assert.equal(result.status, 'recovery');
});


test('workout coach considers saved workouts from the previous two days', () => {
  const result = d.recommendWorkout({
    date: '2026-11-26',
    workouts: [{ date: '2026-11-25', exercise: 'สควอตแตะเก้าอี้', effort: 'พอดี' }]
  });
  assert.ok(result.evidence.some(item => item.includes('2026-11-25')));
  assert.ok(result.suggestions.every(item => !/สควอต/.test(item.name)));
});

test('workout coach recommends recovery when the user reports fatigue even without saved sessions', () => {
  const result = d.recommendWorkout({ date: '2026-11-26', text: 'วันนี้ล้ามาก นอนไม่พอ' });
  assert.equal(result.status, 'recovery');
});
