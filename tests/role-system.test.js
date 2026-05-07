const request = require('supertest');
const path = require('path');
const crypto = require('crypto');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { generateId } = require('../src/db/helpers');
const { importRoleLibrary } = require('../src/services/role_library_import');
const { createRoleGraphPolicy } = require('../src/services/role_graph_policy');
const { assemblePrompt } = require('../src/services/prompt_assembler');

const ROLE_LIBRARY_PATH = path.resolve(__dirname, '..', 'role-library');

/**
 * Creates a test agent and returns app + token for authenticated requests.
 */
function setupAuthApp(db) {
  const app = createTestApp(db);
  const { token, projectId } = insertTestAgent(db);
  return { app, token, projectId };
}

describe('Role Library Import', () => {
  let db;

  beforeEach(() => {
    db = createSeededTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('import creates prompt files from role-library markdown', () => {
    const result = importRoleLibrary(db, ROLE_LIBRARY_PATH);
    expect(result.templatesCreated).toBeGreaterThanOrEqual(0);
    expect(result.filesImported).toBeGreaterThanOrEqual(55);

    const files = db
      .prepare(`SELECT * FROM role_prompt_files WHERE section_key = 'persona' AND is_active = 1`)
      .all();
    expect(files.length).toBeGreaterThanOrEqual(11);
    files.forEach((f) => {
      expect(f.content_md.length).toBeGreaterThan(0);
      expect(f.content_hash).toBeTruthy();
    });
  });

  test('import creates global prompt files', () => {
    importRoleLibrary(db, ROLE_LIBRARY_PATH);
    const globalFiles = db
      .prepare(
        `SELECT * FROM role_prompt_files WHERE role_template_id = 'global' AND is_active = 1`,
      )
      .all();
    expect(globalFiles.length).toBe(7);
  });

  test('unchanged import does not duplicate versions', () => {
    importRoleLibrary(db, ROLE_LIBRARY_PATH);
    const count1 = db.prepare(`SELECT COUNT(*) as c FROM role_prompt_files`).get().c;

    importRoleLibrary(db, ROLE_LIBRARY_PATH);
    const count2 = db.prepare(`SELECT COUNT(*) as c FROM role_prompt_files`).get().c;

    expect(count2).toBe(count1);
  });

  test('changed file creates new version', () => {
    importRoleLibrary(db, ROLE_LIBRARY_PATH);

    const original = db
      .prepare(
        `SELECT * FROM role_prompt_files WHERE section_key = 'persona' AND is_active = 1 LIMIT 1`,
      )
      .get();
    expect(original).toBeTruthy();
    expect(original.version).toBe(1);

    const templateId = original.role_template_id;
    db.prepare(
      `UPDATE role_prompt_files SET content_hash = 'stale' WHERE role_template_id = ? AND section_key = 'persona'`,
    ).run(templateId);

    importRoleLibrary(db, ROLE_LIBRARY_PATH);

    const updated = db
      .prepare(
        `SELECT * FROM role_prompt_files WHERE role_template_id = ? AND section_key = 'persona' AND is_active = 1`,
      )
      .get(templateId);
    expect(updated.version).toBe(2);

    const old = db
      .prepare(
        `SELECT * FROM role_prompt_files WHERE role_template_id = ? AND section_key = 'persona' AND is_active = 0`,
      )
      .all(templateId);
    expect(old.length).toBe(1);
    expect(old[0].version).toBe(1);
  });
});

describe('Role Template APIs', () => {
  let db, app, token;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
  });

  afterEach(() => {
    db.close();
  });

  test('GET /api/role-templates returns all templates', async () => {
    const res = await request(app)
      .get('/api/role-templates')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(11);
  });

  test('GET /api/role-templates/:id returns single template', async () => {
    const templates = db.prepare(`SELECT * FROM role_templates`).all();
    const res = await request(app)
      .get(`/api/role-templates/${templates[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.template.key).toBe(templates[0].key);
  });

  test('GET /api/role-templates/:id returns 404 for missing', async () => {
    const res = await request(app)
      .get(`/api/role-templates/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/role-templates/:id/prompt-files returns files', async () => {
    importRoleLibrary(db, ROLE_LIBRARY_PATH);
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'ceo'`).get();
    const res = await request(app)
      .get(`/api/role-templates/${template.id}/prompt-files`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.files.length).toBe(5);
  });

  test('POST /api/role-templates creates new template', async () => {
    const res = await request(app)
      .post('/api/role-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        key: 'custom-role',
        display_name: 'Custom Role',
        description: 'A custom role for testing',
      });
    expect(res.status).toBe(201);
    expect(res.body.template.key).toBe('custom-role');
  });

  test('PATCH /api/role-templates/:id updates template', async () => {
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'ceo'`).get();
    const res = await request(app)
      .patch(`/api/role-templates/${template.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated CEO description' });
    expect(res.status).toBe(200);
    expect(res.body.template.description).toBe('Updated CEO description');
  });

  test('POST /api/role-templates/import-from-files triggers import', async () => {
    const res = await request(app)
      .post('/api/role-templates/import-from-files')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: ROLE_LIBRARY_PATH });
    expect(res.status).toBe(200);
    expect(res.body.result.filesImported).toBeGreaterThanOrEqual(55);
  });

  test('role APIs reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/role-templates');
    expect(res.status).toBe(401);
  });
});

describe('Project Role Node APIs', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token, projectId } = setupAuthApp(db));
    db.prepare(`UPDATE project_role_instances SET is_active = 0 WHERE project_id = ?`).run(
      projectId,
    );
  });

  afterEach(() => {
    db.close();
  });

  function insertDepartment(pid, key) {
    const existing = db
      .prepare(`SELECT id FROM departments WHERE project_id = ? AND key = ?`)
      .get(pid, key);
    if (existing) return existing.id;

    const id = generateId();
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(id, pid, key, key.charAt(0).toUpperCase() + key.slice(1));
    return id;
  }

  test('GET /api/projects/:projectId/role-nodes returns empty initially', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toEqual([]);
  });

  test('POST /api/projects/:projectId/role-nodes creates node', async () => {
    const deptId = insertDepartment(projectId, 'backend');
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();

    const res = await request(app)
      .post(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        department_id: deptId,
        role_template_id: template.id,
        display_name: 'Backend Engineer',
        canvas_x: 100,
        canvas_y: 200,
      });
    expect(res.status).toBe(201);
    expect(res.body.node.display_name).toBe('Backend Engineer');
    expect(res.body.node.is_active).toBe(1);
  });

  test('POST /api/projects/:projectId/role-nodes validates required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST rejects invalid department_id', async () => {
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        department_id: crypto.randomUUID(),
        role_template_id: template.id,
        display_name: 'Engineer',
      });
    expect(res.status).toBe(400);
  });

  test('POST rejects invalid role_template_id', async () => {
    const deptId = insertDepartment(projectId, 'backend');
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        department_id: deptId,
        role_template_id: crypto.randomUUID(),
        display_name: 'Engineer',
      });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/projects/:projectId/role-nodes/:nodeId updates node', async () => {
    const deptId = insertDepartment(projectId, 'backend');
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();
    const nodeId = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeId, projectId, deptId, template.id, 'Engineer');

    const res = await request(app)
      .patch(`/api/projects/${projectId}/role-nodes/${nodeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'Senior Engineer', canvas_x: 150 });
    expect(res.status).toBe(200);
    expect(res.body.node.display_name).toBe('Senior Engineer');
    expect(res.body.node.canvas_x).toBe(150);
  });

  test('DELETE soft-deletes a role node', async () => {
    const deptId = insertDepartment(projectId, 'backend');
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();
    const nodeId = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeId, projectId, deptId, template.id, 'Engineer');

    const res = await request(app)
      .delete(`/api/projects/${projectId}/role-nodes/${nodeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const activeNodes = db
      .prepare(`SELECT * FROM project_role_instances WHERE project_id = ? AND is_active = 1`)
      .all(projectId);
    expect(activeNodes.length).toBe(0);

    const deletedNode = db.prepare(`SELECT * FROM project_role_instances WHERE id = ?`).get(nodeId);
    expect(deletedNode.is_active).toBe(0);
  });

  test('soft-deleted node does not appear in active list', async () => {
    const deptId = insertDepartment(projectId, 'backend');
    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();
    const nodeId = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeId, projectId, deptId, template.id, 'Engineer');

    await request(app)
      .delete(`/api/projects/${projectId}/role-nodes/${nodeId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/projects/${projectId}/role-nodes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.nodes.length).toBe(0);
  });
});

describe('Role Edge APIs', () => {
  let db, app, token, projectId, nodeA, nodeB;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token, projectId } = setupAuthApp(db));
    db.prepare(`UPDATE project_role_instances SET is_active = 0 WHERE project_id = ?`).run(
      projectId,
    );

    let dept = db
      .prepare(`SELECT id FROM departments WHERE project_id = ? AND key = 'backend'`)
      .get(projectId);
    if (!dept) {
      const deptId = generateId();
      db.prepare(
        `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
      ).run(deptId, projectId, 'backend', 'Backend');
      dept = { id: deptId };
    }
    const deptId = dept.id;

    const ceoTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'ceo'`).get();
    const ctoTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'cto'`).get();

    nodeA = generateId();
    nodeB = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeA, projectId, deptId, ceoTemplate.id, 'CEO');
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeB, projectId, deptId, ctoTemplate.id, 'CTO');
  });

  afterEach(() => {
    db.close();
  });

  test('GET /api/projects/:projectId/role-edges returns empty initially', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/role-edges`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.edges).toEqual([]);
  });

  test('POST /api/projects/:projectId/role-edges creates edge', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-edges`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        from_role_instance_id: nodeA,
        to_role_instance_id: nodeB,
        edge_type: 'hierarchy',
        direction: 'bidirectional',
        can_message: true,
        can_assign_task: true,
        can_escalate: true,
        can_share_context: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.edge.can_message).toBe(1);
    expect(res.body.edge.can_assign_task).toBe(1);
  });

  test('POST validates from and to are required', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-edges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ edge_type: 'hierarchy' });
    expect(res.status).toBe(400);
  });

  test('POST rejects nodes from different project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/role-edges`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        from_role_instance_id: crypto.randomUUID(),
        to_role_instance_id: nodeB,
        edge_type: 'hierarchy',
      });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/projects/:projectId/role-edges/:edgeId updates edge', async () => {
    const edgeId = generateId();
    db.prepare(
      `INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(edgeId, projectId, nodeA, nodeB, 'hierarchy', 'bidirectional');

    const res = await request(app)
      .patch(`/api/projects/${projectId}/role-edges/${edgeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ can_message: true, policy_json: JSON.stringify({ priority: 'high' }) });
    expect(res.status).toBe(200);
    expect(res.body.edge.can_message).toBe(1);
  });

  test('DELETE /api/projects/:projectId/role-edges/:edgeId removes edge', async () => {
    const edgeId = generateId();
    db.prepare(
      `INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(edgeId, projectId, nodeA, nodeB, 'hierarchy', 'bidirectional');

    const res = await request(app)
      .delete(`/api/projects/${projectId}/role-edges/${edgeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const edges = db.prepare(`SELECT * FROM role_edges WHERE project_id = ?`).all(projectId);
    expect(edges.length).toBe(0);
  });
});

describe('Role Graph Policy Service', () => {
  let db, projectId, nodeA, nodeB, nodeC;

  beforeEach(() => {
    db = createSeededTestDb();
    projectId = generateId();
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, 'Test Project', 'test-project', '/workspace/test', 'active');

    const deptId = generateId();
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(deptId, projectId, 'backend', 'Backend');

    const ceoTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'ceo'`).get();
    const ctoTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'cto'`).get();
    const engTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();

    nodeA = generateId();
    nodeB = generateId();
    nodeC = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeA, projectId, deptId, ceoTemplate.id, 'CEO');
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeB, projectId, deptId, ctoTemplate.id, 'CTO');
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(nodeC, projectId, deptId, engTemplate.id, 'Engineer');
  });

  afterEach(() => {
    db.close();
  });

  function addEdge(from, to, flags) {
    db.prepare(
      `INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction, can_message, can_assign_task, can_escalate, can_share_context, can_request_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      generateId(),
      projectId,
      from,
      to,
      'hierarchy',
      'bidirectional',
      flags.can_message ? 1 : 0,
      flags.can_assign_task ? 1 : 0,
      flags.can_escalate ? 1 : 0,
      flags.can_share_context ? 1 : 0,
      flags.can_request_approval ? 1 : 0,
    );
  }

  test('canRoleMessage returns true when edge allows messaging', () => {
    addEdge(nodeA, nodeB, { can_message: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleMessage(nodeA, nodeB)).toBe(true);
  });

  test('canRoleMessage returns true for bidirectional edge', () => {
    addEdge(nodeA, nodeB, { can_message: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleMessage(nodeB, nodeA)).toBe(true);
  });

  test('canRoleMessage returns false when no edge exists', () => {
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleMessage(nodeA, nodeC)).toBe(false);
  });

  test('canRoleAssignTask works from edge data', () => {
    addEdge(nodeA, nodeB, { can_assign_task: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleAssignTask(nodeA, nodeB)).toBe(true);
    expect(policy.canRoleAssignTask(nodeB, nodeA)).toBe(false);
  });

  test('canRoleShareContext works from edge data', () => {
    addEdge(nodeA, nodeB, { can_share_context: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleShareContext(nodeA, nodeB)).toBe(true);
  });

  test('canRoleEscalate works from edge data', () => {
    addEdge(nodeC, nodeB, { can_escalate: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleEscalate(nodeC, nodeB)).toBe(true);
    expect(policy.canRoleEscalate(nodeB, nodeC)).toBe(false);
  });

  test('canRoleRequestApproval works from edge data', () => {
    addEdge(nodeC, nodeA, { can_request_approval: true });
    const policy = createRoleGraphPolicy(db, projectId);
    expect(policy.canRoleRequestApproval(nodeC, nodeA)).toBe(true);
  });
});

describe('Prompt Assembler', () => {
  let db, projectId, agentId, roleNodeId;

  beforeEach(() => {
    db = createSeededTestDb();
    projectId = generateId();
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, 'Test Project', 'test-project', '/workspace/test', 'active');

    const deptId = generateId();
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(deptId, projectId, 'backend', 'Backend');

    const engTemplate = db.prepare(`SELECT * FROM role_templates WHERE key = 'engineer'`).get();
    roleNodeId = generateId();
    db.prepare(
      `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name, model_profile_id, permission_profile_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(roleNodeId, projectId, deptId, engTemplate.id, 'Engineer', null, null);

    agentId = generateId();
    const { hashToken } = require('../src/utils/tokens');
    db.prepare(
      `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(agentId, projectId, deptId, roleNodeId, 'Test Engineer', hashToken('test'), 'active');

    importRoleLibrary(db, ROLE_LIBRARY_PATH);
  });

  afterEach(() => {
    db.close();
  });

  test('prompt assembler includes files in stable order', () => {
    const bundle = assemblePrompt(db, agentId);
    const sectionKeys = bundle.sections.map((s) => s.section_key);

    expect(sectionKeys.indexOf('company-vision')).toBeLessThan(
      sectionKeys.indexOf('company-mission'),
    );
    expect(sectionKeys.indexOf('company-mission')).toBeLessThan(
      sectionKeys.indexOf('communication-rules'),
    );
    expect(sectionKeys.indexOf('communication-rules')).toBeLessThan(
      sectionKeys.indexOf('quality-standards'),
    );
    expect(sectionKeys.indexOf('quality-standards')).toBeLessThan(
      sectionKeys.indexOf('security-rules'),
    );
    expect(sectionKeys.indexOf('security-rules')).toBeLessThan(
      sectionKeys.indexOf('context-rules'),
    );
    expect(sectionKeys.indexOf('context-rules')).toBeLessThan(
      sectionKeys.indexOf('no-assumption-rules'),
    );
    expect(sectionKeys.indexOf('no-assumption-rules')).toBeLessThan(sectionKeys.indexOf('persona'));
    expect(sectionKeys.indexOf('persona')).toBeLessThan(sectionKeys.indexOf('instructions'));
    expect(sectionKeys.indexOf('instructions')).toBeLessThan(sectionKeys.indexOf('rules'));
    expect(sectionKeys.indexOf('rules')).toBeLessThan(sectionKeys.indexOf('communication'));
    expect(sectionKeys.indexOf('communication')).toBeLessThan(sectionKeys.indexOf('output-format'));
  });

  test('prompt assembler does not include unrelated role files', () => {
    const bundle = assemblePrompt(db, agentId);
    const sectionKeys = bundle.sections.map((s) => s.section_key);

    expect(sectionKeys).toContain('persona');
    expect(sectionKeys).toContain('instructions');

    const roleSections = bundle.sections.filter((s) => s.section_key === 'persona');
    expect(roleSections.length).toBe(1);
  });

  test('prompt assembler includes identity block', () => {
    const bundle = assemblePrompt(db, agentId);
    expect(bundle.identity).toBeTruthy();
    expect(bundle.identity.agent_id).toBe(agentId);
    expect(bundle.identity.project_id).toBe(projectId);
  });

  test('prompt assembler includes permission summary', () => {
    const bundle = assemblePrompt(db, agentId);
    expect(bundle.permission_summary).toBeTruthy();
  });
});

describe('Prompt Preview API', () => {
  let db, app, token, agentId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({
      app,
      token,
      agentId: agentId,
    } = (() => {
      const result = insertTestAgent(db);
      return { app: createTestApp(db), token: result.token, agentId: result.agentId };
    })());
    importRoleLibrary(db, ROLE_LIBRARY_PATH);
  });

  afterEach(() => {
    db.close();
  });

  test('GET /api/agents/:agentId/prompt-preview returns assembled prompt for own agent', async () => {
    const res = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bundle).toBeTruthy();
    expect(res.body.bundle.sections.length).toBeGreaterThan(0);
    expect(res.body.bundle.identity).toBeTruthy();
  });

  test('GET /api/agents/:agentId/prompt-preview rejects viewing other agent', async () => {
    const otherResult = insertTestAgent(db, {
      agent_name: 'Other Agent',
      project_slug: 'other-project',
      project_root: '/workspace/other',
    });
    const res = await request(app)
      .get(`/api/agents/${otherResult.agentId}/prompt-preview`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('prompt preview requires authentication', async () => {
    const res = await request(app).get(`/api/agents/${agentId}/prompt-preview`);
    expect(res.status).toBe(401);
  });
});

describe('New Role Template - No Code Changes', () => {
  test('adding a new role template does not require code changes', () => {
    const db = createSeededTestDb();
    const id = generateId();
    db.prepare(
      `INSERT INTO role_templates (id, key, display_name, description) VALUES (?, ?, ?, ?)`,
    ).run(id, 'custom-new-role', 'Custom New Role', 'Added via data, no code change');

    const template = db.prepare(`SELECT * FROM role_templates WHERE key = 'custom-new-role'`).get();
    expect(template).toBeTruthy();
    expect(template.display_name).toBe('Custom New Role');
    db.close();
  });
});

describe('Human Communication Policy', () => {
  let db, projectId, humanInterfaceNodes, otherNodes;

  beforeEach(() => {
    db = createSeededTestDb();
    projectId = generateId();
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, 'Test Project', 'test-project', '/workspace/test', 'active');

    const deptId = generateId();
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
    ).run(deptId, projectId, 'backend', 'Backend');

    humanInterfaceNodes = {};
    otherNodes = {};

    const humanRoles = ['ceo', 'cto', 'product_manager'];
    const otherRoles = [
      'project_manager',
      'architect',
      'tech_lead',
      'engineer',
      'reviewer',
      'tester',
      'git_manager',
      'weekly_audit_agent',
    ];

    for (const key of humanRoles) {
      const template = db.prepare(`SELECT * FROM role_templates WHERE key = ?`).get(key);
      const nodeId = generateId();
      db.prepare(
        `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
      ).run(nodeId, projectId, deptId, template.id, template.display_name);
      humanInterfaceNodes[key] = nodeId;
    }

    for (const key of otherRoles) {
      const template = db.prepare(`SELECT * FROM role_templates WHERE key = ?`).get(key);
      const nodeId = generateId();
      db.prepare(
        `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
      ).run(nodeId, projectId, deptId, template.id, template.display_name);
      otherNodes[key] = nodeId;
    }

    // Seed edges: CEO <-> CTO <-> PM <-> human
    const edgeInsert = db.prepare(
      `INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction, can_message, can_assign_task, can_escalate, can_share_context, can_request_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const edge = (from, to, flags) =>
      edgeInsert.run(
        generateId(),
        projectId,
        from,
        to,
        'hierarchy',
        flags.direction || 'bidirectional',
        flags.can_message ? 1 : 0,
        flags.can_assign_task ? 1 : 0,
        flags.can_escalate ? 1 : 0,
        flags.can_share_context ? 1 : 0,
        flags.can_request_approval ? 1 : 0,
      );

    edge(humanInterfaceNodes.ceo, humanInterfaceNodes.cto, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });
    edge(humanInterfaceNodes.ceo, humanInterfaceNodes.product_manager, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });
    edge(humanInterfaceNodes.cto, humanInterfaceNodes.product_manager, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });

    edge(humanInterfaceNodes.product_manager, otherNodes.project_manager, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(humanInterfaceNodes.cto, otherNodes.architect, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.project_manager, otherNodes.tech_lead, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.architect, otherNodes.tech_lead, {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.tech_lead, otherNodes.engineer, {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.tech_lead, otherNodes.reviewer, {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.tech_lead, otherNodes.tester, {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    edge(otherNodes.reviewer, otherNodes.tester, {
      direction: 'bidirectional',
      can_message: true,
      can_share_context: true,
    });
    edge(otherNodes.reviewer, otherNodes.git_manager, {
      can_message: true,
      can_share_context: true,
    });
    edge(otherNodes.tester, otherNodes.git_manager, {
      can_message: true,
      can_share_context: true,
    });
    edge(otherNodes.weekly_audit_agent, otherNodes.tech_lead, {
      can_message: true,
      can_share_context: true,
    });
  });

  afterEach(() => {
    db.close();
  });

  test('human communication is possible only through CEO/CTO/PM when edges are seeded', () => {
    const policy = createRoleGraphPolicy(db, projectId);

    // Engineer cannot message CEO directly (no edge)
    expect(policy.canRoleMessage(otherNodes.engineer, humanInterfaceNodes.ceo)).toBe(false);
    // Engineer cannot message CTO directly
    expect(policy.canRoleMessage(otherNodes.engineer, humanInterfaceNodes.cto)).toBe(false);
    // Engineer can message Tech Lead
    expect(policy.canRoleMessage(otherNodes.engineer, otherNodes.tech_lead)).toBe(true);
    // CEO can message CTO
    expect(policy.canRoleMessage(humanInterfaceNodes.ceo, humanInterfaceNodes.cto)).toBe(true);
    // CEO can message PM
    expect(
      policy.canRoleMessage(humanInterfaceNodes.ceo, humanInterfaceNodes.product_manager),
    ).toBe(true);
  });
});
