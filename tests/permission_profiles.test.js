const request = require('supertest');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');

describe('Permission Profiles API', () => {
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

  test('rejects unauthenticated GET', async () => {
    const res = await request(app).get('/api/permission-profiles');
    expect(res.status).toBe(401);
  });

  test('rejects unauthenticated POST', async () => {
    const res = await request(app).post('/api/permission-profiles').send({
      key: 'test',
      display_name: 'Test',
    });
    expect(res.status).toBe(401);
  });

  describe('GET /api/permission-profiles', () => {
    test('returns seeded permission profiles', async () => {
      const res = await request(app)
        .get('/api/permission-profiles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.profiles.length).toBeGreaterThanOrEqual(11);

      const keys = res.body.profiles.map((p) => p.key);
      expect(keys).toContain('ceo_default');
      expect(keys).toContain('engineer_default');
      expect(keys).toContain('weekly_audit_default');
    });

    test('profiles include permissions_json with structured fields', async () => {
      const res = await request(app)
        .get('/api/permission-profiles')
        .set('Authorization', `Bearer ${token}`);
      const eng = res.body.profiles.find((p) => p.key === 'engineer_default');
      expect(eng).toBeTruthy();
      const perms = JSON.parse(eng.permissions_json);
      expect(perms.can_write_code).toBe(true);
    });
  });

  describe('POST /api/permission-profiles', () => {
    test('creates permission profile with structured permissions', async () => {
      const permissions = {
        allowed_tools: ['read', 'write', 'bash'],
        forbidden_tools: ['delete_project'],
        allowed_commands: ['npm test', 'npm run lint'],
        blocked_commands: ['rm -rf', 'sudo'],
        git_permissions: { can_commit: true, can_push: false },
        file_permissions: { can_read: true, can_write: true, can_delete: false },
        task_permissions: { can_create: false, can_claim: true },
        message_permissions: { can_send: true, can_escalate: false },
        context_permissions: { can_view_approved: true, can_view_draft: false },
        human_contact_permissions: { can_contact_human: false },
      };

      const res = await request(app)
        .post('/api/permission-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'restricted_engineer',
          display_name: 'Restricted Engineer',
          permissions_json: permissions,
        });
      expect(res.status).toBe(201);
      expect(res.body.profile.key).toBe('restricted_engineer');

      const parsed = JSON.parse(res.body.profile.permissions_json);
      expect(parsed.allowed_tools).toEqual(['read', 'write', 'bash']);
      expect(parsed.forbidden_tools).toEqual(['delete_project']);
      expect(parsed.blocked_commands).toContain('sudo');
    });

    test('validates required fields', async () => {
      const res = await request(app)
        .post('/api/permission-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({ display_name: 'No Key' });
      expect(res.status).toBe(400);
    });

    test('rejects duplicate key', async () => {
      const res = await request(app)
        .post('/api/permission-profiles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'engineer_default',
          display_name: 'Duplicate',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/permission-profiles/:id', () => {
    test('updates permissions', async () => {
      const profiles = db
        .prepare("SELECT * FROM permission_profiles WHERE key = 'engineer_default'")
        .all();
      const profileId = profiles[0].id;

      const newPerms = {
        allowed_tools: ['read', 'write', 'bash', 'glob', 'grep'],
        forbidden_tools: ['delete_project', 'modify_permissions'],
        can_write_code: true,
      };

      const res = await request(app)
        .patch(`/api/permission-profiles/${profileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ permissions_json: newPerms });
      expect(res.status).toBe(200);

      const parsed = JSON.parse(res.body.profile.permissions_json);
      expect(parsed.allowed_tools).toContain('glob');
      expect(parsed.forbidden_tools).toContain('modify_permissions');
    });

    test('returns 404 for unknown profile', async () => {
      const res = await request(app)
        .patch('/api/permission-profiles/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ display_name: 'Test' });
      expect(res.status).toBe(404);
    });
  });

  describe('Permission profile attached to role nodes', () => {
    test('execution context includes permission profile', async () => {
      // Insert a task and check execution context
      const agent = db.prepare('SELECT * FROM agents').get();
      const { generateId } = require('../src/db/helpers');

      // Get the role instance for this agent
      const roleInstance = db
        .prepare('SELECT * FROM project_role_instances WHERE id = ?')
        .get(agent.role_instance_id);

      // Get the permission profile
      const permProfile = db
        .prepare('SELECT * FROM permission_profiles WHERE key = ?')
        .get('engineer_default');

      // Attach permission profile to role instance
      db.prepare('UPDATE project_role_instances SET permission_profile_id = ? WHERE id = ?').run(
        permProfile.id,
        roleInstance.id,
      );

      // Create a task
      const taskId = generateId();
      db.prepare(
        `INSERT INTO tasks (id, project_id, department_id, title, status, priority, lifecycle_stage, created_by_agent_id, assigned_agent_id, assigned_role_instance_id)
         VALUES (?, ?, ?, ?, 'assigned', 'medium', 'mvp', ?, ?, ?)`,
      ).run(
        taskId,
        agent.project_id,
        agent.department_id,
        'Test task',
        agent.id,
        agent.id,
        agent.role_instance_id,
      );

      const res = await request(app)
        .get(`/api/tasks/${taskId}/execution-context`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('allowedTools');
      expect(res.body).toHaveProperty('forbiddenActions');
    });
  });
});
