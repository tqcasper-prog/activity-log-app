const test = require('node:test');
const assert = require('node:assert/strict');
const coach = require('../api/workout-coach');

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('workout coach receives curated evidence and resolves citations from the server catalog', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  const oldFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'unit-test-key';
  let sentPayload;
  global.fetch = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    const generated = {
      reply: 'เลือกท่าตามอุปกรณ์และหลักฐานที่ได้รับ',
      hasPlan: true,
      evidenceIds: ['acsm-rt-2026', 'not-a-real-source'],
      plan: {
        date: '2026-11-27',
        title: 'แผนทดสอบ',
        reason: 'ทดสอบการตรวจสอบแหล่งอ้างอิง',
        restDay: false,
        evidenceSummary: 'ใช้หลักการฝึกแรงต้านแบบค่อยเป็นค่อยไป',
        evidenceIds: ['acsm-rt-2026', 'fake-plan-source'],
        items: [{
          exerciseId: 'wall-push-up',
          exercise: 'ท่าที่โมเดลแต่งเอง',
          rationale: 'เหมาะกับผู้เริ่มต้นและไม่ต้องใช้อุปกรณ์',
          evidenceIds: ['nhs-strength-exercises-2024', 'fake-item-source'],
          sets: 2,
          reps: '8–12',
          restSeconds: 60,
          targetMuscles: 'ข้อความกล้ามเนื้อที่โมเดลแต่ง',
          note: '',
          setup: 'เตรียมพื้นที่ให้โล่ง',
          steps: ['ขั้นตอนปลอมจากโมเดล'],
          breathing: 'คำแนะนำหายใจจากโมเดล',
          commonMistakes: '',
          caution: 'คำเตือนจากโมเดล'
        }]
      }
    };
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
      })
    };
  };
  try {
    const req = {
      method: 'POST',
      headers: { host: 'localhost', origin: 'http://localhost', 'x-forwarded-for': '192.0.2.99' },
      body: { date: '2026-11-27', message: 'วันนี้ควรฝึกอะไร', trainingProfile: { age: 22, goal: 'เพิ่มกล้ามเนื้อ', experience: 'มือใหม่', equipment: 'ไม่มีอุปกรณ์' }, readinessHistory: [{ date: '2026-11-27', sleep: 7, energy: 4, notes: 'ข้อความส่วนตัวที่ไม่ควรถูกส่ง' }] },
      socket: { remoteAddress: '192.0.2.99' }
    };
    const res = mockResponse();
    await coach(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(sentPayload.contents[0].parts[0].text.includes('evidenceBase'), true);
    const context = JSON.parse(sentPayload.contents[0].parts[0].text);
    assert.equal(context.evidenceBase.exercises.length, 8);
    assert.equal(context.dailyReadinessHistory[0].notes, undefined);
    assert.equal(res.body.hasPlan, true);
    assert.equal(res.body.evidence.length, 1);
    assert.equal(res.body.evidence[0].id, 'acsm-rt-2026');
    assert.equal(res.body.plan.items.length, 1);
    assert.equal(res.body.plan.evidenceLibraryVersion, '2026-11-27.1');
    const item = res.body.plan.items[0];
    assert.equal(item.exercise, 'วิดพื้นกับกำแพง');
    assert.deepEqual(item.steps, ['ยืนหันหน้าเข้ากำแพงในระยะประมาณช่วงแขน วางฝ่ามือระดับอก','เกร็งลำตัวให้เป็นแนวตรง ไม่แอ่นเอว','งอศอกอย่างควบคุม พาลำตัวเข้าใกล้กำแพง','ดันกลับสู่ท่าเริ่มต้นโดยไม่กระแทกข้อศอก']);
    assert.equal(item.breathing.includes('โมเดล'), false);
    assert.deepEqual(item.evidence.map(source => source.id), ['nhs-strength-exercises-2024']);
    assert.equal(item.evidence[0].url, 'https://www.nhs.uk/live-well/exercise/strength-exercises/');
    assert.equal(res.body.plan.evidence.some(source => source.id === 'fake-plan-source'), false);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
