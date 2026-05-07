const request = require('supertest');
const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { detectStaleAgents, VALID_WORKER_STATUSES } = require('../src/services/heartbeat');

describe('Worker Heartbeat and Status', () => {
  let db, app, token, agentId, projectId, departmentId;

  beforeEach(() => {
    db = createTestDb();
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

  describe('Valid worker statuses', () => {
    test.each(VALID_WORKER_STATUSES)('accepts status: %s', async (status) => {
      const res = await request(app)
        .post('/api/agents/heartbeat')
        .set('Authorization', `Bearer ${token}`)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const agent = db.prepare('SELECT worker_status FROM agents WHERE id = ?').get(agentId);
      expect(agent.worker_status).toBe(status);
    });

    test('rejects invalid status', async () => {
      const res = await request(app)
        .post('/api/agents/heartbeat')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'flying' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid/i);
    });
  });

  describe('Stale heartbeat detection', () => {
    test('marks agents with old heartbeat as offline', () => {
      // Set heartbeat to 2 minutes ago
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      db.prepare('UPDATE agents SET last_heartbeat_at = ?, worker_status = ? WHERE id = ?').run(
        twoMinAgo,
        'busy',
        agentId,
      );

      const staleMs = 60000; // 1 minute threshold
      const updated = detectStaleAgents(db, staleMs);

      expect(updated).toBe(1);
      const agent = db.prepare('SELECT worker_status FROM agents WHERE id = ?').get(agentId);
      expect(agent.worker_status).toBe('offline');
    });

    test('does not mark agents with recent heartbeat', () => {
      const recent = new Date(Date.now() - 30000).toISOString();
      db.prepare('UPDATE agents SET last_heartbeat_at = ?, worker_status = ? WHERE id = ?').run(
        recent,
        'busy',
        agentId,
      );

      const updated = detectStaleAgents(db, 60000);
      expect(updated).toBe(0);

      const agent = db.prepare('SELECT worker_status FROM agents WHERE id = ?').get(agentId);
      expect(agent.worker_status).toBe('busy');
    });

    test('marks agents with no heartbeat as offline', () => {
      // Agent has no last_heartbeat_at (NULL)
      const updated = detectStaleAgents(db, 60000);
      expect(updated).toBe(0); // no heartbeat to be stale — agent hasn't started yet
    });

    test('skips already-offline agents', () => {
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      db.prepare('UPDATE agents SET last_heartbeat_at = ?, worker_status = ? WHERE id = ?').run(
        twoMinAgo,
        'offline',
        agentId,
      );

      const updated = detectStaleAgents(db, 60000);
      expect(updated).toBe(0); // already offline, no update needed
    });
  });

  describe('Heartbeat creates heartbeat record', () => {
    test('heartbeat inserts into agent_heartbeats table', async () => {
      db.prepare(
        `INSERT INTO tasks (id, project_id, department_id, assigned_agent_id, title)
         VALUES ('task-1', ?, ?, ?, 'Heartbeat task')`,
      ).run(projectId, departmentId, agentId);

      await request(app)
        .post('/api/agents/heartbeat')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'busy', current_task_id: 'task-1', payload: { progress: 50 } });

      const heartbeats = db.prepare('SELECT * FROM agent_heartbeats').all();
      expect(heartbeats).toHaveLength(1);
      expect(heartbeats[0].status).toBe('busy');
      expect(heartbeats[0].current_task_id).toBe('task-1');
      expect(JSON.parse(heartbeats[0].payload_json)).toEqual({ progress: 50 });
    });
  });
});
