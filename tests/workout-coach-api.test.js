const test = require('node:test');
const assert = require('node:assert/strict');
const workoutCoach = require('../api/workout-coach');

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('workout coach endpoint rejects methods other than POST', async () => {
  const req = { method: 'GET', headers: {}, socket: {} };
  const res = mockResponse();
  await workoutCoach(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

test('workout coach endpoint rejects cross-origin browser requests', async () => {
  const req = { method: 'POST', headers: { origin: 'https://attacker.example', host: 'planner.example' }, socket: {} };
  const res = mockResponse();
  await workoutCoach(req, res);
  assert.equal(res.statusCode, 403);
});

test('workout coach endpoint reports missing server-side Gemini key without exposing secrets', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const req = { method: 'POST', headers: { host: 'planner.example', origin: 'https://planner.example' }, body: { date: '2026-11-26', message: 'ช่วยวางแผน' }, socket: {} };
    const res = mockResponse();
    await workoutCoach(req, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /GEMINI_API_KEY/);
    assert.equal(JSON.stringify(res.body).includes('AIza'), false);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
