/* Life & Health Planner domain logic — dependency-free and testable in Node/browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LHPDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORIES = ['งาน', 'เรียน', 'ออกกำลังกาย', 'พักผ่อน', 'ชีวิตประจำวัน', 'เดินทาง', 'อื่น ๆ'];
  const pad = n => String(n).padStart(2, '0');
  function localDate(date = new Date()) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw new Error('วันที่ไม่มีอยู่จริง');
    return date;
  }
  function addDays(value, amount) {
    const d = parseDate(value); d.setDate(d.getDate() + amount); return localDate(d);
  }
  function weekStart(value) {
    const d = parseDate(value); const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset); return localDate(d);
  }
  function dateRange(value, period) {
    const d = parseDate(value);
    if (period === 'day') return { start: value, end: value };
    if (period === 'week') { const start = weekStart(value); return { start, end: addDays(start, 6) }; }
    if (period === 'month') return { start: localDate(new Date(d.getFullYear(), d.getMonth(), 1)), end: localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    if (period === 'year') return { start: d.getFullYear() + '-01-01', end: d.getFullYear() + '-12-31' };
    throw new Error('ช่วงรายงานไม่ถูกต้อง');
  }
  function minutesBetween(start, end) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new Error('กรุณาระบุเวลาให้ถูกต้อง');
    const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number);
    let result = eh * 60 + em - (sh * 60 + sm);
    if (result <= 0) result += 1440;
    if (result > 1440) throw new Error('ระยะเวลาต้องไม่เกิน 24 ชั่วโมง');
    return result;
  }
  function validateActivity(activity) {
    if (!activity || !String(activity.title || '').trim()) throw new Error('กรุณาระบุชื่อกิจกรรม');
    parseDate(activity.date);
    const minutes = minutesBetween(activity.start, activity.end);
    if (minutes <= 0) throw new Error('ช่วงเวลาต้องมากกว่า 0 นาที');
    return { ...activity, title: String(activity.title).trim(), durationMinutes: minutes };
  }
  function findOverlaps(candidate, activities, ignoreId) {
    const start = candidate.start, end = candidate.end;
    const to = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const a0 = to(start), a1 = to(end) <= a0 ? to(end) + 1440 : to(end);
    return activities.filter(item => item.date === candidate.date && item.id !== ignoreId).filter(item => {
      const b0 = to(item.start), raw = to(item.end), b1 = raw <= b0 ? raw + 1440 : raw;
      return a0 < b1 && b0 < a1;
    });
  }
  function inRange(date, range) { return date >= range.start && date <= range.end; }
  function sumTimeLogs(logs, range) {
    const selected = logs.filter(x => inRange(x.date, range));
    const byCategory = {};
    let minutes = 0;
    for (const log of selected) {
      const duration = Math.max(0, Number(log.durationMinutes) || 0);
      minutes += duration;
      byCategory[log.category || 'อื่น ๆ'] = (byCategory[log.category || 'อื่น ๆ'] || 0) + duration;
    }
    return { minutes, byCategory, count: selected.length };
  }
  function sumNutrition(entries, date) {
    return entries.filter(x => x.date === date).reduce((sum, x) => {
      for (const key of ['calories', 'protein', 'carbs', 'fat']) sum[key] += Math.max(0, Number(x[key]) || 0);
      sum.count++;
      return sum;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  }
  function bmi(weightKg, heightCm) {
    const w = Number(weightKg), h = Number(heightCm);
    if (!(w > 0) || !(h > 0)) return null;
    return w / ((h / 100) ** 2);
  }
  function migrateLegacy(legacy) {
    const activities = (legacy.activities || []).map((a, i) => {
      const [start, end] = String(a.time || '').split(/[–-]/).map(s => s.trim());
      return { id: 'legacy-a-' + i, title: a.name || 'กิจกรรมเดิม', category: a.category || 'อื่น ๆ',
        date: a.date || '', dayName: a.day || '', start: /^\d{2}:\d{2}$/.test(start || '') ? start : '09:00',
        end: /^\d{2}:\d{2}$/.test(end || '') ? end : '10:00', status: 'planned', legacy: true };
    });
    const logs = (legacy.logs || []).map((x, i) => ({ id: 'legacy-l-' + i, date: x.date || '', category: x.category || 'อื่น ๆ',
      title: x.detail || x.category || 'บันทึกเดิม', durationMinutes: Math.round((Number(x.hours) || 0) * 60), notes: '', legacy: true }));
    const meals = (legacy.foods || []).map((x, i) => ({ id: 'legacy-f-' + i, date: x.date || '', meal: x.meal || 'ไม่ระบุ',
      title: x.name || 'อาหารเดิม', serving: '', calories: Number(x.cal) || 0, protein: Number(x.protein) || 0,
      carbs: Number(x.carb) || 0, fat: Number(x.fat) || 0, source: 'ค่าจากข้อมูลเดิม', confidence: 'estimated', legacy: true }));
    return { activities, logs, meals };
  }
  return { CATEGORIES, localDate, parseDate, addDays, weekStart, dateRange, minutesBetween, validateActivity,
    findOverlaps, sumTimeLogs, sumNutrition, bmi, migrateLegacy, inRange };
});
