const request = require('supertest');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');

describe('Model Profiles API', () => {
  let db, app, token;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);
    const result = insertTestAgent(db);
    token = result.token;
  });

  afterEach(() => {
    db.close();
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/model-profiles');
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated POST', async () => {
    const res = await request(app).post('/api/model-profiles').send({
      key: 'test',
      display_name: 'Test',
      provider: 'test',
      model: 'test',
    });
    expect(res.status).toBe(401);
  });

  describe('GET /api/model-profiles', () => {
    test('returns seeded model profiles', async () => {
      const res = await request(app)
        .get('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.profiles.length).toBeGreaterThanOrEqual(4);

      const keys = res.body.profiles.map((p) => p.key);
      expect(keys).toContain('strong_reasoning');
      expect(keys).toContain('coding');
      expect(keys).toContain('economy');
      expect(keys).toContain('audit_strong');
    });

    test('profiles include provider, model, purpose fields', async () => {
      const res = await request(app)
        .get('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`);
      const profile = res.body.profiles.find((p) => p.key === 'strong_reasoning');
      expect(profile.provider).toBe('anthropic');
      expect(profile.model).toBeTruthy();
      expect(profile.purpose).toBeTruthy();
    });

    test('api_key_ref is present but never a raw key', async () => {
      const res = await request(app)
        .get('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`);
      for (const p of res.body.profiles) {
        // api_key_ref should be an env var name or null, never sk-xxx
        if (p.api_key_ref) {
          expect(p.api_key_ref).not.toMatch(/^sk-/);
        }
      }
    });
  });

  describe('POST /api/model-profiles', () => {
    test('creates a new model profile', async () => {
      const res = await request(app)
        .post('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'custom_model',
          display_name: 'Custom Model',
          provider: 'openai',
          model: 'gpt-4',
          purpose: 'Custom tasks',
          api_key_ref: 'OPENAI_API_KEY',
          config_json: { temperature: 0.7 },
        });
      expect(res.status).toBe(201);
      expect(res.body.profile.key).toBe('custom_model');
      expect(res.body.profile.provider).toBe('openai');
      expect(res.body.profile.api_key_ref).toBe('OPENAI_API_KEY');
    });

    test('validates required fields', async () => {
      const res = await request(app)
        .post('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({ display_name: 'No Key' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test('rejects duplicate key', async () => {
      const res = await request(app)
        .post('/api/model-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'coding',
          display_name: 'Duplicate',
          provider: 'anthropic',
          model: 'test',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/model-profiles/:id', () => {
    test('updates model profile fields', async () => {
      const profiles = db.prepare('SELECT * FROM model_profiles WHERE key = ?').all('coding');
      const profileId = profiles[0].id;

      const res = await request(app)
        .patch(`/api/model-profiles/${profileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ model: 'claude-opus-4-6', api_key_ref: 'ANTHROPIC_API_KEY' });
      expect(res.status).toBe(200);
      expect(res.body.profile.model).toBe('claude-opus-4-6');
      expect(res.body.profile.api_key_ref).toBe('ANTHROPIC_API_KEY');
    });

    test('returns 404 for unknown profile', async () => {
      const res = await request(app)
        .patch('/api/model-profiles/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ model: 'test' });
      expect(res.status).toBe(404);
    });
  });

  test('raw API keys are not logged in responses', async () => {
    // Create profile with api_key_ref pointing to env var
    await request(app).post('/api/model-profiles').set('Authorization', `Bearer ${token}`).send({
      key: 'secure_test',
      display_name: 'Secure Test',
      provider: 'google',
      model: 'gemini-pro',
      api_key_ref: 'GOOGLE_API_KEY',
    });

    const res = await request(app)
      .get('/api/model-profiles')
      .set('Authorization', `Bearer ${token}`);
    const profile = res.body.profiles.find((p) => p.key === 'secure_test');
    // Should be the env var name, not a raw key
    expect(profile.api_key_ref).toBe('GOOGLE_API_KEY');
    expect(profile).not.toHaveProperty('api_key');
  });
});
