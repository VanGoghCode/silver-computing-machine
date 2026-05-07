const request = require('supertest');
const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');

describe('Agent Routes', () => {
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

  test('GET /api/agents/me returns current agent identity', async () => {
    const res = await request(app).get('/api/agents/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Agent');
    expect(res.body.status).toBe('active');
    expect(res.body.project.slug).toBe('test-project');
    expect(res.body.department.key).toBe('backend');
    expect(res.body.role.key).toBe('engineer');
  });

  test('POST /api/agents/heartbeat updates agent status', async () => {
    db.prepare(
      `INSERT INTO tasks (id, project_id, department_id, assigned_agent_id, title)
       VALUES ('task-1', ?, ?, ?, 'Heartbeat task')`,
    ).run(projectId, departmentId, agentId);

    const res = await request(app)
      .post('/api/agents/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'busy', current_task_id: 'task-1' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify heartbeat was recorded
    const heartbeats = db.prepare('SELECT * FROM agent_heartbeats').all();
    expect(heartbeats.length).toBe(1);
    expect(heartbeats[0].status).toBe('busy');
    expect(heartbeats[0].current_task_id).toBe('task-1');
  });

  test('POST /api/agents/heartbeat requires status', async () => {
    const res = await request(app)
      .post('/api/agents/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/my-tasks returns empty list', async () => {
    const res = await request(app).get('/api/my-tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });
});
