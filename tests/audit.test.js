const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');
const request = require('supertest');

describe('Weekly audit flow', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    const agent = insertTestAgent(db, { role_key: 'weekly-audit' });
    token = agent.token;
    projectId = agent.projectId;
  });

  afterEach(() => {
    db.close();
  });

  test('POST /api/projects/:projectId/audits/run creates audit run and report artifact', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/audits/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.audit_run).toBeDefined();
    expect(res.body.audit_run.project_id).toBe(projectId);
    expect(res.body.audit_run.status).toBe('completed');
    expect(res.body.audit_run.report_artifact_id).toBeDefined();

    // Verify context artifact was created
    const artifact = db
      .prepare('SELECT * FROM context_artifacts WHERE id = ?')
      .get(res.body.audit_run.report_artifact_id);
    expect(artifact).toBeDefined();
    expect(artifact.artifact_type).toBe('audit_report');
  });

  test('POST /api/projects/:projectId/audits/run sends message to Tech Lead', async () => {
    // Create a tech-lead agent in the project
    const { generateId } = require('../src/db/helpers');
    const deptId = generateId();
    db.prepare(
      `INSERT OR IGNORE INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(deptId, projectId, 'core', 'Core');

    let tlTemplate = db.prepare(`SELECT id FROM role_templates WHERE key = 'tech-lead'`).get();
    if (!tlTemplate) {
      tlTemplate = { id: generateId() };
      db.prepare(
        `INSERT INTO role_templates (id, key, display_name, description) VALUES (?, ?, ?, ?)`,
      ).run(tlTemplate.id, 'tech-lead', 'Tech Lead', 'Test tech lead');
    }

    const roleInstanceId = generateId();
    db.prepare(
      `INSERT OR IGNORE INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(roleInstanceId, projectId, deptId, tlTemplate.id, 'Tech Lead');

    const res = await request(app)
      .post(`/api/projects/${projectId}/audits/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({ department_id: deptId });

    expect(res.status).toBe(201);
    // Check that a message was created
    const messages = db.prepare('SELECT * FROM messages WHERE project_id = ?').all(projectId);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/projects/:projectId/audits/run requires auth', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/audits/run`).send({});
    expect(res.status).toBe(401);
  });

  test('GET /api/projects/:projectId/audits lists audit runs', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/audits/run`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .get(`/api/projects/${projectId}/audits`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.audit_runs.length).toBe(1);
    expect(res.body.audit_runs[0].project_id).toBe(projectId);
  });
});
