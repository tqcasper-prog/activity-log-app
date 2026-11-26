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
  const TRAINING_PATTERNS = {
    push: /วิดพื้น|ดันพื้น|วอลล์?\s*พุช|wall\s*push|push[ -]?up|pushup|อก|ท่าอก|bench\s*press/i,
    legs: /สควอต|สควอท|squat|ลันจ์|lunge|ขา|ต้นขา|leg\s*day|ขึ้นบันได/i,
    core: /แพลงก์|plank|เบิร์ดด็อก|bird[ -]?dog|ครันช์|crunch|ซิตอัป|sit[ -]?up|หน้าท้อง|แกนกลาง/i,
    glutes: /กลูตบริดจ์|glute\s*bridge|สะพานก้น|hip\s*thrust|สะโพก|ก้น/i,
    cardio: /วิ่ง|เดินเร็ว|เดินเยอะ|ปั่นจักรยาน|ปั่น|cycling|running|jogging|cardio|กระโดดเชือก/i,
    full: /full[ -]?body|ทั้งตัว|ทั่วร่างกาย|เบอร์พี|burpee|วงจรทั้งตัว/i
  };
  function classifyTraining(text) {
    const value = String(text || '');
    return Object.keys(TRAINING_PATTERNS).filter(group => TRAINING_PATTERNS[group].test(value));
  }
  function recommendWorkout({ date, text = '', workouts = [] } = {}) {
    parseDate(date);
    const today = parseDate(date);
    const recent = (Array.isArray(workouts) ? workouts : []).filter(item => {
      if (!item || !/^\\d{4}-\\d{2}-\\d{2}$/.test(String(item.date || ''))) return false;
      try {
        const diff = Math.round((today - parseDate(item.date)) / 86400000);
        return diff >= 0 && diff <= 2;
      } catch { return false; }
    });
    const input = String(text || '').replace(/ไม่เจ็บ|ไม่ปวด|ไม่มีอาการเจ็บ|ไม่มีอาการปวด/g, '');
    const inputGroups = classifyTraining(input);
    const recentGroups = recent.flatMap(item => classifyTraining([item.exercise, item.notes].filter(Boolean).join(' ')));
    const trained = [...new Set([...inputGroups, ...recentGroups])];
    const evidence = [];
    recent.forEach(item => evidence.push(item.date + ': ' + (item.exercise || 'บันทึกการฝึก')));
    if (inputGroups.length) evidence.push('ข้อความที่คุณเล่าระบุ: ' + inputGroups.map(group => ({push:'อก/ท่าดัน',legs:'ขา',core:'แกนกลางลำตัว',glutes:'สะโพก',cardio:'คาร์ดิโอ',full:'ทั้งร่างกาย'}[group])).join(', '));
    const pain = /บาดเจ็บ|เจ็บ|ปวด|เวียนหัว|หน้ามืด|เป็นไข้|มีไข้|ไม่สบาย|เจ็บข้อ|เจ็บหน้าอก/i.test(input);
    const fatigue = /ล้ามาก|เหนื่อยมาก|หมดแรง|เพลียมาก|นอนไม่พอ|นอนน้อย|พักผ่อนน้อย|หนักมาก|ฟื้นตัวไม่ทัน/i.test(input) ||
      recent.some(item => ['หนัก','เหนื่อยมาก'].includes(item.effort));
    const restToday = /วันนี้.{0,12}(พัก|หยุด)|พักวันนี้|วันนี้ไม่ไหว/i.test(input);
    if (pain) return {
      status: 'rest', title: 'วันนี้ยังไม่ควรฝืนออกกำลังกาย',
      reason: 'ข้อความมีการกล่าวถึงอาการเจ็บปวดหรืออาการผิดปกติ จึงไม่แนะนำให้ฝึกต่อเพื่อความปลอดภัย',
      evidence, suggestions: [], caution: 'หยุดท่าที่กระตุ้นอาการ หากเจ็บรุนแรง เจ็บหน้าอก หายใจลำบาก เวียนศีรษะมาก หรืออาการไม่ดีขึ้น ควรขอคำแนะนำจากบุคลากรทางการแพทย์'
    };
    if (restToday || (fatigue && recent.length)) return {
      status: 'recovery', title: 'เลือกพักหรือฟื้นตัวเบา ๆ',
      reason: restToday ? 'คุณระบุว่าวันนี้ต้องการพัก จึงไม่จำเป็นต้องฝืนทำเวท' : 'มีสัญญาณความล้าร่วมกับการฝึกในช่วง 3 วันที่ผ่านมา การเพิ่มความหนักวันนี้อาจไม่เหมาะ',
      evidence, suggestions: [{ name: 'เดินสบาย ๆ', dose: '10–20 นาที เฉพาะเมื่อรู้สึกไหว' }, { name: 'ขยับข้อต่อเบา ๆ', dose: '5 นาที ไม่ฝืนช่วงการเคลื่อนไหว' }],
      caution: 'หากยิ่งทำแล้วยิ่งล้า ให้หยุดและพักเต็มที่'
    };
    if (trained.includes('full') || (trained.includes('push') && trained.includes('legs') && trained.includes('core'))) return {
      status: 'recovery', title: 'แนะนำวันฟื้นตัว',
      reason: 'ข้อมูลที่ให้มาครอบคลุมการฝึกหลายส่วนของร่างกายในช่วงใกล้กัน วันนี้จึงควรเน้นการฟื้นตัวแทนการเพิ่มความหนัก',
      evidence, suggestions: [{ name: 'เดินสบาย ๆ', dose: '10–20 นาที' }, { name: 'ยืดเหยียดเบา ๆ', dose: '5–8 นาที ไม่ฝืน' }],
      caution: 'กลับไปฝึกเมื่อความล้าลดลงและเคลื่อนไหวได้ตามปกติ'
    };
    const options = [
      { group: 'legs', name: 'สควอตแตะเก้าอี้', dose: '2 เซ็ต × 8–10 ครั้ง' },
      { group: 'glutes', name: 'กลูตบริดจ์', dose: '2 เซ็ต × 10–12 ครั้ง' },
      { group: 'push', name: 'วิดพื้นแบบพิงกำแพง', dose: '2 เซ็ต × 8–10 ครั้ง' },
      { group: 'core', name: 'เบิร์ดด็อก', dose: '2 เซ็ต × 6 ครั้งต่อข้าง' }
    ];
    const available = options.filter(option => !trained.includes(option.group));
    const chosen = available.slice(0, trained.length ? 2 : 3);
    if (!chosen.length) return {
      status: 'recovery', title: 'วันนี้ควรพักจากการฝึกแรงต้าน',
      reason: 'ส่วนหลักที่ระบบรู้จักถูกใช้งานในช่วงใกล้กันแล้ว จึงไม่พบชุดฝึกที่เหมาะจะเสนอโดยไม่ซ้ำกล้ามเนื้อเดิม',
      evidence, suggestions: [{ name: 'เดินสบาย ๆ', dose: '10–15 นาที หากรู้สึกสดชื่น' }],
      caution: 'ระบบรู้จักรูปแบบการฝึกพื้นฐานบางส่วนเท่านั้น หากมีกิจกรรมอื่นที่ไม่ได้บันทึก ให้เล่าเพิ่มได้'
    };
    return {
      status: 'train', title: 'แผนที่แนะนำสำหรับวันนี้',
      reason: trained.length
        ? 'หลีกเลี่ยงส่วนที่คุณเพิ่งใช้งาน แล้วเลือกฝึกส่วนอื่นในระดับเริ่มต้น'
        : 'ยังไม่พบประวัติการฝึกใกล้วันที่เลือก จึงเสนอชุดฝึกพื้นฐานแบบไม่หนักเกินไป',
      evidence, suggestions: chosen, caution: 'พักระหว่างเซ็ตประมาณ 60–90 วินาที ทำช้า ๆ ในช่วงที่ควบคุมท่าได้ และหยุดหากมีอาการเจ็บ'
    };
  }
  return { CATEGORIES, localDate, parseDate, addDays, weekStart, dateRange, minutesBetween, validateActivity,
    findOverlaps, sumTimeLogs, sumNutrition, bmi, migrateLegacy, inRange, classifyTraining, recommendWorkout };
});
