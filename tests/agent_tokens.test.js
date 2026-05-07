const request = require('supertest');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { hashToken } = require('../src/utils/tokens');

describe('Agent Token Management', () => {
  let db, app, token, agentId, projectId, departmentId;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);
    const result = insertTestAgent(db);
    token = result.token;
    agentId = result.agentId;
    projectId = result.projectId;
    departmentId = result.departmentId;
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/agents — create agent with token', () => {
    test('creates agent and returns plain token once', async () => {
      const { generateId } = require('../src/db/helpers');
      const roleInstanceId = generateId();
      const roleTemplate = db
        .prepare(`SELECT id FROM role_templates WHERE key = ?`)
        .get('engineer');
      db.prepare(
        `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
      ).run(roleInstanceId, projectId, departmentId, roleTemplate.id, 'Engineer 2');

      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          project_id: projectId,
          department_id: departmentId,
          role_instance_id: roleInstanceId,
          name: 'Engineer 2',
        });

      expect(res.status).toBe(201);
      expect(res.body.agent).toHaveProperty('id');
      expect(res.body.agent.name).toBe('Engineer 2');
      expect(res.body.token).toMatch(/^silver_[a-f0-9]{64}$/);

      // Token hash stored, not plain token
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(res.body.agent.id);
      expect(agent.token_hash).not.toBe(res.body.token);
      expect(agent.token_hash).toBe(hashToken(res.body.token));
    });

    test('requires auth', async () => {
      const res = await request(app).post('/api/agents').send({ name: 'Foo' });
      expect(res.status).toBe(401);
    });

    test('validates required fields', async () => {
      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Foo' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  describe('GET /api/agents — list agents', () => {
    test('returns all agents for the project', async () => {
      const res = await request(app).get('/api/agents').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].name).toBe('Test Agent');
      // Never include token_hash in listing
      expect(res.body.agents[0]).not.toHaveProperty('token_hash');
    });
  });

  describe('GET /api/agents/:id — get agent by id', () => {
    test('returns agent details', async () => {
      const res = await request(app)
        .get(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.agent.id).toBe(agentId);
      expect(res.body.agent).not.toHaveProperty('token_hash');
    });

    test('returns 404 for unknown agent', async () => {
      const res = await request(app)
        .get('/api/agents/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/agents/:id/token/rotate — rotate token', () => {
    test('generates new token, invalidates old', async () => {
      const res = await request(app)
        .post(`/api/agents/${agentId}/token/rotate`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^silver_[a-f0-9]{64}$/);
      expect(res.body.token).not.toBe(token);

      // Old token no longer works
      const oldRes = await request(app)
        .get('/api/agents/me')
        .set('Authorization', `Bearer ${token}`);
      expect(oldRes.status).toBe(401);

      // New token works
      const newRes = await request(app)
        .get('/api/agents/me')
        .set('Authorization', `Bearer ${res.body.token}`);
      expect(newRes.status).toBe(200);
    });

    test('returns 404 for unknown agent', async () => {
      const res = await request(app)
        .post('/api/agents/nonexistent/token/rotate')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test('rejects rotation of revoked agent', async () => {
      // Revoke first
      await request(app)
        .post(`/api/agents/${agentId}/revoke`)
        .set('Authorization', `Bearer ${token}`);

      // Now try to rotate — but token is revoked so we need a different agent
      const { generateId } = require('../src/db/helpers');
      const { generateToken, hashToken } = require('../src/utils/tokens');
      const otherRoleId = generateId();
      const otherAgentId = generateId();
      const otherToken = generateToken();
      const rt = db.prepare("SELECT id FROM role_templates WHERE key = 'engineer'").get();
      db.prepare(
        `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
      ).run(otherRoleId, projectId, departmentId, rt.id, 'Other');
      db.prepare(
        `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        otherAgentId,
        projectId,
        departmentId,
        otherRoleId,
        'Other',
        hashToken(otherToken),
        'active',
      );

      // Revoke the first agent (already done above, but use the other agent's token)
      const res = await request(app)
        .post(`/api/agents/${agentId}/token/rotate`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/revoked/i);
    });
  });

  describe('POST /api/agents/:id/revoke — revoke agent', () => {
    test('revokes agent token', async () => {
      const res = await request(app)
        .post(`/api/agents/${agentId}/revoke`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      // Token no longer works
      const authRes = await request(app)
        .get('/api/agents/me')
        .set('Authorization', `Bearer ${token}`);
      expect(authRes.status).toBe(401);

      // Agent status updated
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
      expect(agent.status).toBe('revoked');
    });

    test('returns 404 for unknown agent', async () => {
      const res = await request(app)
        .post('/api/agents/nonexistent/revoke')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
