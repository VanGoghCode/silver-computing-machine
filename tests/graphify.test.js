const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');
const request = require('supertest');

describe('Graphify integration', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db, { graphifyCommand: 'node -e "process.exit(0)"' });
    const agent = insertTestAgent(db);
    token = agent.token;
    projectId = agent.projectId;
  });

  afterEach(() => {
    db.close();
  });

  test('POST /api/projects/:projectId/graphify/run creates a graphify run', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/graphify/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ trigger_reason: 'manual' });

    expect(res.status).toBe(201);
    expect(res.body.graphify_run).toBeDefined();
    expect(res.body.graphify_run.project_id).toBe(projectId);
    expect(res.body.graphify_run.status).toBe('completed');
    expect(res.body.graphify_run.trigger_reason).toBe('manual');
  });

  test('POST /api/projects/:projectId/graphify/run handles missing command gracefully', async () => {
    const appMissing = createTestApp(db, { graphifyCommand: 'nonexistent-command-xyz-123' });
    const res = await request(appMissing)
      .post(`/api/projects/${projectId}/graphify/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.graphify_run).toBeDefined();
    expect(res.body.graphify_run.status).toBe('error');
    expect(res.body.graphify_run.error_md).toBeDefined();
  });

  test('POST /api/projects/:projectId/graphify/run requires auth', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/graphify/run`).send({});

    expect(res.status).toBe(401);
  });

  test('GET /api/projects/:projectId/graphify/runs lists runs', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/graphify/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ trigger_reason: 'manual' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/graphify/runs`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.graphify_runs.length).toBe(1);
    expect(res.body.graphify_runs[0].project_id).toBe(projectId);
  });

  test('GET /api/graphify/query returns empty when no graphify-out', async () => {
    const res = await request(app)
      .get('/api/graphify/query?q=test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
  });
});
