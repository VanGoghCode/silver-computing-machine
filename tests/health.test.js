const request = require('supertest');
const { createTestDb, createTestApp } = require('./helpers');

describe('GET /api/health', () => {
  let db, app;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterEach(() => {
    db.close();
  });

  test('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('workspace');
  });
});
