const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { MockRuntimeManager } = require('../src/services/runtime_manager');

describe('Project Creation Workflow', () => {
  let db, app, token, tmpDir;

  beforeEach(() => {
    db = createSeededTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-test-'));
    app = createTestApp(db, { projectsDir: tmpDir, runtimeManager: new MockRuntimeManager() });
    const result = insertTestAgent(db);
    token = result.token;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('POST /api/projects', () => {
    test('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'My App', slug: 'my-app' });
      expect(res.status).toBe(401);
    });

    test('creates project row', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('My App');
      expect(res.body.project.slug).toBe('my-app');
      expect(res.body.project.status).toBe('active');
      expect(res.body.project.runtime_status).toBe('stopped');
    });

    test('creates project folder safely', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      expect(res.status).toBe(201);

      const projectDir = path.join(tmpDir, 'my-app');
      expect(fs.existsSync(projectDir)).toBe(true);
    });

    test('project path isolation prevents escaping Projects/<slug>', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Evil', slug: '../etc' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid.*slug/i);
    });

    test('creates default departments', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      const projectId = res.body.project.id;

      const depts = db.prepare('SELECT * FROM departments WHERE project_id = ?').all(projectId);
      expect(depts.length).toBeGreaterThanOrEqual(1);

      const deptKeys = depts.map((d) => d.key);
      expect(deptKeys).toContain('core');
    });

    test('creates role nodes from templates', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      const projectId = res.body.project.id;

      const instances = db
        .prepare(
          `SELECT pri.*, rt.key as role_key
           FROM project_role_instances pri
           JOIN role_templates rt ON rt.id = pri.role_template_id
           WHERE pri.project_id = ? AND pri.is_active = 1`,
        )
        .all(projectId);

      // Should have 11 default roles
      expect(instances.length).toBe(11);

      const roleKeys = instances.map((i) => i.role_key);
      expect(roleKeys).toContain('ceo');
      expect(roleKeys).toContain('cto');
      expect(roleKeys).toContain('engineer');
      expect(roleKeys).toContain('weekly_audit_agent');
    });

    test('creates default role edges', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      const projectId = res.body.project.id;

      const edges = db.prepare('SELECT * FROM role_edges WHERE project_id = ?').all(projectId);

      // Default graph has ~14 edges
      expect(edges.length).toBeGreaterThanOrEqual(10);

      // Verify some key edges exist
      const canMessageEdges = edges.filter((e) => e.can_message === 1);
      expect(canMessageEdges.length).toBeGreaterThan(0);
    });

    test('creates default agents when requested', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app', create_agents: true });
      const projectId = res.body.project.id;

      const agents = db.prepare('SELECT * FROM agents WHERE project_id = ?').all(projectId);

      // Should have agents for each role
      expect(agents.length).toBe(11);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.length).toBe(11);

      // Each token is a plain token
      for (const t of res.body.tokens) {
        expect(t.token).toMatch(/^silver_[a-f0-9]{64}$/);
        expect(t.agent_name).toBeTruthy();
      }
    });

    test('without create_agents, no agents are created', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });

      const agents = db
        .prepare('SELECT * FROM agents WHERE project_id = ?')
        .all(res.body.project.id);
      expect(agents.length).toBe(0);
    });

    test('rejects duplicate slug', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'First', slug: 'my-app' });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Second', slug: 'my-app' });
      expect(res.status).toBe(409);
    });

    test('validates required fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No Slug' });
      expect(res.status).toBe(400);
    });

    test('creates initial empty document set structure', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      const projectId = res.body.project.id;

      // Should create an initial discovery document set
      const docSets = db.prepare('SELECT * FROM document_sets WHERE project_id = ?').all(projectId);
      expect(docSets.length).toBeGreaterThanOrEqual(1);
      expect(docSets[0].stage).toBe('discovery');
    });
  });

  describe('POST /api/projects/:id/start-runtime', () => {
    test('starts project runtime', async () => {
      const proj = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });

      const res = await request(app)
        .post(`/api/projects/${proj.body.project.id}/start-runtime`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('running');

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(proj.body.project.id);
      expect(project.runtime_status).toBe('running');
    });

    test('returns 404 for unknown project', async () => {
      const res = await request(app)
        .post('/api/projects/nonexistent/start-runtime')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/stop-runtime', () => {
    test('stops project runtime', async () => {
      const proj = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app' });
      await request(app)
        .post(`/api/projects/${proj.body.project.id}/start-runtime`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/projects/${proj.body.project.id}/stop-runtime`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('stopped');
    });
  });

  describe('POST /api/projects/:id/spawn-workers', () => {
    test('spawns workers for all project agents', async () => {
      const proj = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app', create_agents: true });
      await request(app)
        .post(`/api/projects/${proj.body.project.id}/start-runtime`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/projects/${proj.body.project.id}/spawn-workers`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.spawned).toBe(11);
    });

    test('fails if runtime is not running', async () => {
      const proj = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My App', slug: 'my-app', create_agents: true });

      const res = await request(app)
        .post(`/api/projects/${proj.body.project.id}/spawn-workers`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Project isolation', () => {
    test('Project-A cannot access Project-B folder', () => {
      const { safePath } = require('../src/services/path_safety');
      const projectA = path.join(tmpDir, 'project-a');

      // Attempt to access project B from project A's root
      const result = safePath(projectA, '..', 'project-b', 'secret.js');
      expect(result).toBeNull();
    });

    test('project slug with path traversal characters is rejected', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Evil', slug: 'good-project/../../etc' });
      expect(res.status).toBe(400);
    });

    test('project slug only allows alphanumeric, hyphens, underscores', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test', slug: 'valid-project_name' });
      expect(res.status).toBe(201);
    });
  });
});
