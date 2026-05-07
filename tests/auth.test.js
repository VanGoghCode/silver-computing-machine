const request = require('supertest');
const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');

describe('Bearer Token Auth', () => {
  let db, app;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterEach(() => {
    db.close();
  });

  test('Missing Authorization header returns 401', async () => {
    const res = await request(app).get('/api/agents/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing/i);
  });

  test('Invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/agents/me')
      .set('Authorization', 'Bearer invalid_token_here');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid/i);
  });

  test('Empty bearer token returns 401', async () => {
    const res = await request(app).get('/api/agents/me').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  test('Valid token returns agent identity', async () => {
    const { token } = insertTestAgent(db);
    const res = await request(app).get('/api/agents/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'Test Agent');
    expect(res.body).toHaveProperty('project');
    expect(res.body).toHaveProperty('department');
    expect(res.body).toHaveProperty('role');
  });

  test('GET /api/health is public (no auth needed)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
