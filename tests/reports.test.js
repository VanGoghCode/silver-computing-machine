const { createTestDb, createTestApp, insertTestAgent } = require('./helpers');
const request = require('supertest');

describe('Daily report generation', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    const agent = insertTestAgent(db);
    token = agent.token;
    projectId = agent.projectId;
  });

  afterEach(() => {
    db.close();
  });

  test('POST /api/projects/:projectId/reports/daily creates daily report artifact', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/reports/daily`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.artifact_type).toBe('daily_report');
    expect(res.body.report.content_md).toBeDefined();
    expect(res.body.report.content_md).toContain('Yesterday Completed');
    expect(res.body.report.content_md).toContain('Today Planned');
    expect(res.body.report.content_md).toContain('Blockers');
    expect(res.body.report.content_md).toContain('Risks');
    expect(res.body.report.content_md).toContain('Questions for Customer');
    expect(res.body.report.content_md).toContain('Security Concerns');
  });

  test('POST /api/projects/:projectId/reports/daily requires auth', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/reports/daily`).send({});
    expect(res.status).toBe(401);
  });

  test('GET /api/projects/:projectId/reports lists daily reports', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/reports/daily`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .get(`/api/projects/${projectId}/reports`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBe(1);
    expect(res.body.reports[0].artifact_type).toBe('daily_report');
  });

  test('daily report includes task statistics', async () => {
    // Create a task in the project
    const { generateId } = require('../src/db/helpers');
    const deptId = generateId();
    db.prepare(
      `INSERT OR IGNORE INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(deptId, projectId, 'core', 'Core');

    const taskId = generateId();
    db.prepare(
      `INSERT INTO tasks (id, project_id, department_id, title, status, lifecycle_stage, priority)
       VALUES (?, ?, ?, 'Test task', 'done', 'mvp', 'medium')`,
    ).run(taskId, projectId, deptId);

    const res = await request(app)
      .post(`/api/projects/${projectId}/reports/daily`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.report.content_md).toContain('done');
  });
});
