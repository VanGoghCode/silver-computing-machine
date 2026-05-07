const request = require('supertest');
const { createTestDb, createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { generateId } = require('../src/db/helpers');
const { hashToken } = require('../src/utils/tokens');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertFullHierarchy(db, projectId) {
  const deptId = generateId();
  db.prepare(
    `INSERT OR IGNORE INTO departments (id, project_id, key, display_name) VALUES (?, ?, 'engineering', 'Engineering')`,
  ).run(deptId, projectId);

  const roles = [
    'ceo',
    'cto',
    'product_manager',
    'project_manager',
    'architect',
    'tech_lead',
    'engineer',
    'reviewer',
    'tester',
    'git_manager',
    'weekly_audit_agent',
  ];

  const instanceIds = {};
  for (const role of roles) {
    const tpl = db.prepare(`SELECT id FROM role_templates WHERE key = ?`).get(role);
    if (!tpl) continue;
    const instId = generateId();
    db.prepare(
      `INSERT OR IGNORE INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
    ).run(instId, projectId, deptId, tpl.id, role);
    instanceIds[role] = instId;
  }

  // Seed edges
  const edgeInsert = db.prepare(`
    INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id,
      edge_type, direction, can_message, can_assign_task, can_escalate, can_share_context,
      can_request_approval, requires_approval, policy_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function edge(from, to, opts = {}) {
    if (!instanceIds[from] || !instanceIds[to]) return;
    edgeInsert.run(
      generateId(),
      projectId,
      instanceIds[from],
      instanceIds[to],
      opts.edge_type || 'hierarchy',
      opts.direction || 'upstream',
      opts.can_message ? 1 : 0,
      opts.can_assign_task ? 1 : 0,
      opts.can_escalate ? 1 : 0,
      opts.can_share_context ? 1 : 0,
      opts.can_request_approval ? 1 : 0,
      opts.requires_approval ? 1 : 0,
      '{}',
    );
  }

  edge('ceo', 'cto', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
    can_request_approval: true,
  });
  edge('ceo', 'product_manager', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
    can_request_approval: true,
  });
  edge('cto', 'product_manager', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
    can_request_approval: true,
  });
  edge('product_manager', 'project_manager', {
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('cto', 'architect', {
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('project_manager', 'tech_lead', {
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('architect', 'tech_lead', {
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('tech_lead', 'engineer', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('tech_lead', 'reviewer', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('tech_lead', 'tester', {
    direction: 'bidirectional',
    can_message: true,
    can_assign_task: true,
    can_escalate: true,
    can_share_context: true,
  });
  edge('reviewer', 'tester', {
    direction: 'bidirectional',
    can_message: true,
    can_share_context: true,
  });
  edge('reviewer', 'git_manager', { can_message: true, can_share_context: true });
  edge('tester', 'git_manager', { can_message: true, can_share_context: true });
  edge('weekly_audit_agent', 'tech_lead', { can_message: true, can_share_context: true });

  return { deptId, instanceIds };
}

function insertAgentForRole(db, projectId, deptId, roleKey) {
  const tpl = db.prepare(`SELECT id FROM role_templates WHERE key = ?`).get(roleKey);
  if (!tpl) throw new Error(`No role template for ${roleKey}`);
  const instId = generateId();
  db.prepare(
    `INSERT OR IGNORE INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
  ).run(instId, projectId, deptId, tpl.id, roleKey);

  const token = require('../src/utils/tokens').generateToken();
  const tokenHash = hashToken(token);
  const agentId = generateId();
  db.prepare(
    `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(agentId, projectId, deptId, instId, `${roleKey}-agent`, tokenHash, 'active');

  return { token, agentId, instId };
}

function insertApprovedArtifact(db, projectId, artifactType, lifecycleStage = 'mvp') {
  const id = generateId();
  db.prepare(
    `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, version, status, lifecycle_stage, is_archived)
     VALUES (?, ?, ?, ?, ?, 1, 'approved', ?, 0)`,
  ).run(
    id,
    projectId,
    artifactType,
    `Approved ${artifactType}`,
    `Content for ${artifactType}`,
    lifecycleStage,
  );
  return id;
}

function insertTask(db, projectId, overrides = {}) {
  const id = generateId();
  db.prepare(
    `INSERT INTO tasks (id, project_id, department_id, lifecycle_stage, created_by_agent_id, assigned_agent_id,
     assigned_role_instance_id, title, description_md, status, priority, base_branch, branch_name,
     todo_md, acceptance_criteria_md, linked_artifact_ids_json, pipeline_iteration, blocked_reason_md)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    overrides.department_id || null,
    overrides.lifecycle_stage || 'mvp',
    overrides.created_by_agent_id || null,
    overrides.assigned_agent_id || null,
    overrides.assigned_role_instance_id || null,
    overrides.title || 'Test Task',
    overrides.description_md || '',
    overrides.status || 'backlog',
    overrides.priority || 'medium',
    overrides.base_branch || 'main',
    overrides.branch_name || null,
    overrides.todo_md || null,
    overrides.acceptance_criteria_md || null,
    overrides.linked_artifact_ids_json || '[]',
    overrides.pipeline_iteration || 0,
    overrides.blocked_reason_md || null,
  );
  return id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Task CRUD', () => {
  let db, app, agent;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
  });

  afterEach(() => db.close());

  test('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        project_id: agent.projectId,
        title: 'Build auth module',
        description_md: 'Implement JWT auth',
        priority: 'high',
      });
    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.title).toBe('Build auth module');
    expect(res.body.task.status).toBe('backlog');
    expect(res.body.task.created_by_agent_id).toBe(agent.agentId);
  });

  test('GET /api/tasks/:id returns a task', async () => {
    const taskId = insertTask(db, agent.projectId);
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(taskId);
  });

  test('GET /api/tasks lists tasks for project', async () => {
    insertTask(db, agent.projectId);
    insertTask(db, agent.projectId);
    const res = await request(app)
      .get(`/api/tasks?project_id=${agent.projectId}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(2);
  });
});

describe('Task lifecycle transitions', () => {
  let db, app, agent, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
    projectId = agent.projectId;
  });

  afterEach(() => db.close());

  test('backlog -> ready requires approved linked docs', async () => {
    const taskId = insertTask(db, projectId, { status: 'backlog' });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'ready' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot move to ready/);
  });

  test('backlog -> ready succeeds with approved linked docs', async () => {
    const artId = insertApprovedArtifact(db, projectId, 'product_requirements');
    const artId2 = insertApprovedArtifact(db, projectId, 'acceptance_criteria');
    const taskId = insertTask(db, projectId, {
      status: 'backlog',
      linked_artifact_ids_json: JSON.stringify([artId, artId2]),
    });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'ready' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('ready');
  });

  test('ready -> assigned', async () => {
    const taskId = insertTask(db, projectId, { status: 'ready', assigned_agent_id: agent.agentId });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'assigned' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('assigned');
  });

  test('assigned -> in_progress via claim', async () => {
    const taskId = insertTask(db, projectId, {
      status: 'assigned',
      assigned_agent_id: agent.agentId,
    });
    const res = await request(app)
      .post(`/api/tasks/${taskId}/claim`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  test('claim fails if not assigned to agent', async () => {
    const other = insertTestAgent(db, {
      project_id: projectId,
      dept_key: 'frontend',
      agent_name: 'Other Agent',
    });
    const taskId = insertTask(db, projectId, {
      status: 'assigned',
      assigned_agent_id: other.agentId,
    });
    const res = await request(app)
      .post(`/api/tasks/${taskId}/claim`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(403);
  });

  test('in_progress -> review', async () => {
    const taskId = insertTask(db, projectId, {
      status: 'in_progress',
      assigned_agent_id: agent.agentId,
    });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'review' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('review');
    // pipeline_iteration should increment
    expect(res.body.task.pipeline_iteration).toBe(1);
  });

  test('review -> testing', async () => {
    const taskId = insertTask(db, projectId, { status: 'review', pipeline_iteration: 1 });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'testing' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('testing');
  });

  test('testing -> done', async () => {
    const taskId = insertTask(db, projectId, { status: 'testing', pipeline_iteration: 1 });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
  });

  test('review -> in_progress with reason (rework)', async () => {
    const taskId = insertTask(db, projectId, { status: 'review', pipeline_iteration: 1 });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'in_progress', reason: 'Found bugs in auth flow' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  test('pipeline_iteration limit prevents infinite loops', async () => {
    const taskId = insertTask(db, projectId, { status: 'in_progress', pipeline_iteration: 2 });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'review' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pipeline/i);
  });

  test('invalid transition is rejected', async () => {
    const taskId = insertTask(db, projectId, { status: 'backlog' });
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transition/);
  });
});

describe('Worker task APIs', () => {
  let db, app, agent;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
  });

  afterEach(() => db.close());

  test('GET /api/my-tasks returns only assigned agent tasks', async () => {
    const myTaskId = insertTask(db, agent.projectId, { assigned_agent_id: agent.agentId });
    const other = insertTestAgent(db, {
      project_id: agent.projectId,
      dept_key: 'frontend',
      agent_name: 'Other Agent',
    });
    insertTask(db, agent.projectId, { assigned_agent_id: other.agentId, title: 'Other Task' });

    const res = await request(app)
      .get('/api/my-tasks')
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].id).toBe(myTaskId);
  });

  test('POST /api/tasks/:id/events creates event', async () => {
    const taskId = insertTask(db, agent.projectId);
    const res = await request(app)
      .post(`/api/tasks/${taskId}/events`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        event_type: 'comment',
        content_md: 'Starting work on this task',
      });
    expect(res.status).toBe(201);
    expect(res.body.event.event_type).toBe('comment');
    expect(res.body.event.agent_id).toBe(agent.agentId);
  });

  test('POST /api/tasks/:id/complete stores result', async () => {
    const taskId = insertTask(db, agent.projectId, {
      status: 'testing',
      pipeline_iteration: 1,
      assigned_agent_id: agent.agentId,
    });
    const res = await request(app)
      .post(`/api/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        result: { files_changed: ['src/auth.js'], summary: 'Auth module done' },
      });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
  });

  test('POST /api/tasks/:id/fail stores failure', async () => {
    const taskId = insertTask(db, agent.projectId, {
      status: 'in_progress',
      assigned_agent_id: agent.agentId,
    });
    const res = await request(app)
      .post(`/api/tasks/${taskId}/fail`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        reason: 'Missing dependency',
        result: { error: 'Module xyz not found' },
      });
    expect(res.status).toBe(200);
    // Task should still exist with history
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    expect(task).toBeDefined();
    // An attempt should exist
    const attempts = db.prepare('SELECT * FROM task_attempts WHERE task_id = ?').all(taskId);
    expect(attempts.length).toBe(1);
    expect(JSON.parse(attempts[0].result_json).error).toBe('Module xyz not found');
  });
});

describe('Task todos', () => {
  let db, app, agent, taskId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
    taskId = insertTask(db, agent.projectId);

    // Insert some todos
    for (let i = 0; i < 3; i++) {
      db.prepare(
        `INSERT INTO task_todos (id, task_id, position, content_md, status) VALUES (?, ?, ?, ?, ?)`,
      ).run(generateId(), taskId, i, `Todo item ${i}`, 'pending');
    }
  });

  afterEach(() => db.close());

  test('GET /api/tasks/:id returns task with todos', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.task.todos).toBeDefined();
    expect(res.body.task.todos.length).toBe(3);
  });

  test('PATCH /api/tasks/:id/todos/:todoId updates todo', async () => {
    const todo = db.prepare('SELECT * FROM task_todos WHERE task_id = ?').get(taskId);
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/todos/${todo.id}`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'done', notes_md: 'Completed successfully' });
    expect(res.status).toBe(200);
    expect(res.body.todo.status).toBe('done');
    expect(res.body.todo.notes_md).toBe('Completed successfully');
  });
});

describe('Execution context', () => {
  let db, app, agent, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
    projectId = agent.projectId;
  });

  afterEach(() => db.close());

  test('execution-context includes static prompt bundle', async () => {
    const taskId = insertTask(db, projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
    });
    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe(taskId);
    expect(res.body.assignedAgentName).toBe('Test Agent');
    expect(res.body.roleInstanceId).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.staticContext).toBeDefined();
  });

  test('execution-context includes approved dynamic context', async () => {
    const artId = insertApprovedArtifact(db, projectId, 'product_requirements');
    const taskId = insertTask(db, projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
      linked_artifact_ids_json: JSON.stringify([artId]),
    });
    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.dynamicContext).toContain('Content for product_requirements');
    const found = res.body.sourceArtifacts.find((c) => c.artifactId === artId);
    expect(found).toBeDefined();
    expect(found.status).toBe('approved');
  });

  test('execution-context includes source artifact IDs and versions', async () => {
    const artId = insertApprovedArtifact(db, projectId, 'acceptance_criteria');
    const taskId = insertTask(db, projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
      linked_artifact_ids_json: JSON.stringify([artId]),
    });
    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.sourceArtifacts).toBeDefined();
    expect(res.body.sourceArtifacts.length).toBeGreaterThanOrEqual(1);
    const src = res.body.sourceArtifacts.find((s) => s.artifactId === artId);
    expect(src).toBeDefined();
    expect(src.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Messaging tests
// ---------------------------------------------------------------------------

describe('Messaging', () => {
  let db, app, projectId, deptId, instanceIds, agents;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);

    db.prepare(
      `INSERT OR IGNORE INTO projects (id, name, slug, root_path, status) VALUES (?, 'MsgProj', 'msg-proj', '/tmp', 'active')`,
    ).run('proj-msg');
    projectId = 'proj-msg';

    const hierarchy = insertFullHierarchy(db, projectId);
    deptId = hierarchy.deptId;
    instanceIds = hierarchy.instanceIds;

    agents = {};
    for (const role of ['ceo', 'cto', 'product_manager', 'tech_lead', 'engineer', 'reviewer']) {
      agents[role] = insertAgentForRole(db, projectId, deptId, role);
    }

    const agentRole = (role) =>
      db.prepare('SELECT role_instance_id FROM agents WHERE id = ?').get(agents[role].agentId)
        .role_instance_id;
    const edgeInsert = db.prepare(`
      INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id,
        edge_type, direction, can_message, can_assign_task, can_escalate, can_share_context,
        can_request_approval, requires_approval, policy_json)
      VALUES (?, ?, ?, ?, 'hierarchy', 'bidirectional', 1, 0, 1, 1, 0, 0, '{}')
    `);
    edgeInsert.run(generateId(), projectId, agentRole('tech_lead'), agentRole('engineer'));
    edgeInsert.run(generateId(), projectId, agentRole('tech_lead'), agentRole('reviewer'));
  });

  afterEach(() => db.close());

  test('role edge allows authorized message', async () => {
    // tech_lead -> engineer is allowed (bidirectional can_message)
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.tech_lead.token}`)
      .send({
        project_id: projectId,
        to_agent_id: agents.engineer.agentId,
        from_role_instance_id: instanceIds.tech_lead,
        to_role_instance_id: instanceIds.engineer,
        content_md: 'Please implement the auth module',
        message_type: 'notification',
      });
    expect(res.status).toBe(201);
    expect(res.body.message.content_md).toBe('Please implement the auth module');
  });

  test('role edge blocks unauthorized message', async () => {
    // engineer -> ceo has no direct edge (no can_message)
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.engineer.token}`)
      .send({
        project_id: projectId,
        to_agent_id: agents.ceo.agentId,
        from_role_instance_id: instanceIds.engineer,
        to_role_instance_id: instanceIds.ceo,
        content_md: 'Hey CEO',
        message_type: 'notification',
      });
    expect(res.status).toBe(403);
  });

  test('human direct message from Engineer is blocked', async () => {
    // Engineer has no edge to human
    const humanId = generateId();
    db.prepare(
      `INSERT INTO humans (id, display_name, role) VALUES (?, 'Test Human', 'local_owner')`,
    ).run(humanId);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.engineer.token}`)
      .send({
        project_id: projectId,
        to_human_id: humanId,
        from_role_instance_id: instanceIds.engineer,
        content_md: 'Direct to human',
        message_type: 'question',
      });
    expect(res.status).toBe(403);
  });

  test('escalation message chain works through hierarchy', async () => {
    // Step 1: engineer asks tech_lead (bidirectional edge)
    const r1 = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.engineer.token}`)
      .send({
        project_id: projectId,
        to_agent_id: agents.tech_lead.agentId,
        from_role_instance_id: instanceIds.engineer,
        to_role_instance_id: instanceIds.tech_lead,
        content_md: 'How should I handle token refresh?',
        message_type: 'question',
      });
    expect(r1.status).toBe(201);

    // Step 2: tech_lead escalates to reviewer (bidirectional edge)
    const r2 = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.tech_lead.token}`)
      .send({
        project_id: projectId,
        to_agent_id: agents.reviewer.agentId,
        from_role_instance_id: instanceIds.tech_lead,
        to_role_instance_id: instanceIds.reviewer,
        content_md: 'Engineer asks about token refresh - need review',
        message_type: 'escalation',
      });
    expect(r2.status).toBe(201);

    // Step 3: reviewer answers back to tech_lead (bidirectional edge)
    const r3 = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${agents.reviewer.token}`)
      .send({
        project_id: projectId,
        to_agent_id: agents.tech_lead.agentId,
        from_role_instance_id: instanceIds.reviewer,
        to_role_instance_id: instanceIds.tech_lead,
        content_md: 'Use refresh token rotation pattern',
        message_type: 'answer',
      });
    expect(r3.status).toBe(201);
  });

  test('GET /api/conversations lists conversations', async () => {
    // Create a conversation
    db.prepare(
      `INSERT INTO conversations (id, project_id, title, conversation_type) VALUES (?, ?, ?, ?)`,
    ).run(generateId(), projectId, 'Auth Discussion', 'task');

    const res = await request(app)
      .get(`/api/conversations?project_id=${projectId}`)
      .set('Authorization', `Bearer ${agents.engineer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.conversations.length).toBe(1);
  });

  test('GET /api/conversations/:id/messages lists messages', async () => {
    const convId = generateId();
    db.prepare(
      `INSERT INTO conversations (id, project_id, title, conversation_type) VALUES (?, ?, ?, ?)`,
    ).run(convId, projectId, 'Test Conv', 'general');

    db.prepare(
      `INSERT INTO messages (id, project_id, conversation_id, from_agent_id, content_md, message_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(generateId(), projectId, convId, agents.engineer.agentId, 'Hello', 'notification');

    const res = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${agents.engineer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Local PR tests
// ---------------------------------------------------------------------------

describe('Local PRs', () => {
  let db, app, agent;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
  });

  afterEach(() => db.close());

  test('POST /api/local-prs creates a PR', async () => {
    const taskId = insertTask(db, agent.projectId);
    const res = await request(app)
      .post('/api/local-prs')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        project_id: agent.projectId,
        task_id: taskId,
        title: 'Add auth module',
        summary_md: 'Implements JWT authentication',
        branch_name: 'feature/auth',
        base_branch: 'main',
        changed_files_json: ['src/auth.js', 'tests/auth.test.js'],
      });
    expect(res.status).toBe(201);
    expect(res.body.local_pr.title).toBe('Add auth module');
    expect(res.body.local_pr.status).toBe('draft');
    expect(res.body.local_pr.created_by_agent_id).toBe(agent.agentId);
  });

  test('GET /api/local-prs lists PRs', async () => {
    db.prepare(`INSERT INTO local_prs (id, project_id, title, status) VALUES (?, ?, ?, ?)`).run(
      generateId(),
      agent.projectId,
      'PR 1',
      'draft',
    );

    const res = await request(app)
      .get(`/api/local-prs?project_id=${agent.projectId}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.local_prs.length).toBe(1);
  });

  test('GET /api/local-prs/:id returns PR', async () => {
    const prId = generateId();
    db.prepare(`INSERT INTO local_prs (id, project_id, title, status) VALUES (?, ?, ?, ?)`).run(
      prId,
      agent.projectId,
      'PR 1',
      'draft',
    );

    const res = await request(app)
      .get(`/api/local-prs/${prId}`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.local_pr.id).toBe(prId);
  });

  test('PATCH /api/local-prs/:id updates PR', async () => {
    const prId = generateId();
    db.prepare(`INSERT INTO local_prs (id, project_id, title, status) VALUES (?, ?, ?, ?)`).run(
      prId,
      agent.projectId,
      'PR 1',
      'draft',
    );

    const res = await request(app)
      .patch(`/api/local-prs/${prId}`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        status: 'ready',
        review_status: 'approved',
        self_review_md: 'Code looks good',
      });
    expect(res.status).toBe(200);
    expect(res.body.local_pr.status).toBe('ready');
    expect(res.body.local_pr.review_status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// Execution context full contract
// ---------------------------------------------------------------------------

describe('Execution context full contract', () => {
  let db, app, agent, projectId;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db);
    projectId = agent.projectId;
  });

  afterEach(() => db.close());

  test('execution context includes all required fields', async () => {
    const taskId = insertTask(db, projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
      acceptance_criteria_md: '- Auth works\n- Tests pass',
      base_branch: 'main',
      branch_name: 'feature/auth',
    });
    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);

    const ctx = res.body;
    expect(ctx.taskId).toBe(taskId);
    expect(ctx.description).toBeDefined();
    expect(ctx.projectId).toBe(projectId);
    expect(ctx.departmentId).toBeDefined();
    expect(ctx.roleInstanceId).toBeDefined();
    expect(ctx.lifecycleStage).toBeDefined();
    expect(ctx.todoList).toBeDefined();
    expect(ctx.acceptanceCriteria).toEqual(['Auth works', 'Tests pass']);
    expect(ctx.branch).toBe('feature/auth');
    expect(ctx.baseBranch).toBe('main');
    expect(ctx.allowedTools).toBeDefined();
    expect(ctx.forbiddenActions).toBeDefined();
    expect(ctx.dopamineInfo).toBeDefined();
    expect(ctx.sourceArtifacts).toBeDefined();
  });
});
