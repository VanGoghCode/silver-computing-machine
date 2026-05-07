const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { generateId } = require('../src/db/helpers');

function getAgent(db, agentId) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
}

function insertArtifact(db, projectId, overrides = {}) {
  const id = generateId();
  db.prepare(
    `INSERT INTO context_artifacts
     (id, project_id, artifact_type, title, content_md, version, status, lifecycle_stage, is_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    overrides.artifact_type || 'product_requirements',
    overrides.title || 'Artifact',
    overrides.content_md || 'Artifact content',
    overrides.version || 1,
    overrides.status || 'approved',
    overrides.lifecycle_stage || 'mvp',
    overrides.is_archived || 0,
  );

  db.prepare(
    `INSERT INTO context_revisions (id, artifact_id, version, content_md, change_summary_md)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    generateId(),
    id,
    overrides.version || 1,
    overrides.content_md || 'Artifact content',
    'Initial version',
  );
  return id;
}

function insertTask(db, projectId, overrides = {}) {
  const id = generateId();
  db.prepare(
    `INSERT INTO tasks
     (id, project_id, department_id, lifecycle_stage, created_by_agent_id, assigned_agent_id,
      assigned_role_instance_id, title, description_md, status, priority, base_branch, branch_name,
      todo_md, acceptance_criteria_md, linked_artifact_ids_json, pipeline_iteration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    overrides.department_id || null,
    overrides.lifecycle_stage || 'mvp',
    overrides.created_by_agent_id || null,
    overrides.assigned_agent_id || null,
    overrides.assigned_role_instance_id || null,
    overrides.title || 'Harden contract',
    overrides.description_md || 'Execute the task safely',
    overrides.status || 'assigned',
    overrides.priority || 'medium',
    overrides.base_branch || 'main',
    overrides.branch_name || 'feature/hardening',
    overrides.todo_md || '- Do one thing',
    overrides.acceptance_criteria_md || '- It works',
    overrides.linked_artifact_ids_json || '[]',
    overrides.pipeline_iteration || 0,
  );
  return id;
}

function addRoleEdge(db, projectId, fromRoleInstanceId, toRoleInstanceId, flags = {}) {
  db.prepare(
    `INSERT INTO role_edges
     (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction,
      can_message, can_assign_task, can_escalate, can_share_context, can_request_approval, policy_json)
     VALUES (?, ?, ?, ?, 'hierarchy', ?, ?, ?, ?, ?, ?, '{}')`,
  ).run(
    generateId(),
    projectId,
    fromRoleInstanceId,
    toRoleInstanceId,
    flags.direction || 'bidirectional',
    flags.can_message ? 1 : 0,
    flags.can_assign_task ? 1 : 0,
    flags.can_escalate ? 1 : 0,
    flags.can_share_context ? 1 : 0,
    flags.can_request_approval ? 1 : 0,
  );
}

function setupTwoProjectAgents(db) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-hardening-'));
  const agentA = insertTestAgent(db, {
    project_name: 'Project A',
    project_slug: 'project-a',
    project_root: path.join(projectRoot, 'Projects', 'project-a'),
    role_key: 'engineer',
    agent_name: 'Engineer A',
  });
  const agentB = insertTestAgent(db, {
    project_name: 'Project B',
    project_slug: 'project-b',
    project_root: path.join(projectRoot, 'Projects', 'project-b'),
    role_key: 'engineer',
    agent_name: 'Engineer B',
  });
  return { agentA, agentB, projectRoot };
}

function assertCrispyParserAccepts(executionContext) {
  const crispyRoot = process.env.CRISPY_ADVENTURE_DIR || 'D:\\Code\\Crispy-Adventure';
  const parserPath = path.join(
    crispyRoot,
    'packages',
    'coding-agent',
    'dist',
    'core',
    'worker',
    'execution-context.js',
  );
  if (!fs.existsSync(parserPath)) return;

  const script = `
    import { readFileSync } from 'node:fs';
    import { parseExecutionContext } from ${JSON.stringify(pathToFileURL(parserPath).href)};
    parseExecutionContext(JSON.parse(readFileSync(0, 'utf8')));
  `;
  execFileSync('node', ['--input-type=module', '-e', script], {
    input: JSON.stringify(executionContext),
  });
}

describe('project isolation and identity hardening', () => {
  let db, app;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);
  });

  afterEach(() => db.close());

  test('unsafe /api/files routes are not exposed', async () => {
    const { agentA } = setupTwoProjectAgents(db);

    const unauth = await request(app).get('/api/files');
    expect([401, 404]).toContain(unauth.status);

    await request(app)
      .get('/api/files/CLAUDE.md')
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);
    await request(app)
      .put('/api/files/Projects/project-b/.env')
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ content: 'SECRET=1' })
      .expect(404);
  });

  test('agent cannot read or list tasks from another project', async () => {
    const { agentA, agentB } = setupTwoProjectAgents(db);
    const otherTaskId = insertTask(db, agentB.projectId, { title: 'Other project task' });
    insertTask(db, agentA.projectId, { title: 'Own project task' });

    const getRes = await request(app)
      .get(`/api/tasks/${otherTaskId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app)
      .get(`/api/tasks?project_id=${agentB.projectId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.tasks).toHaveLength(1);
    expect(listRes.body.tasks[0].project_id).toBe(agentA.projectId);
  });

  test('agent cannot read or link artifacts from another project', async () => {
    const { agentA, agentB } = setupTwoProjectAgents(db);
    const ownArtifactId = insertArtifact(db, agentA.projectId, { title: 'Own artifact' });
    const otherArtifactId = insertArtifact(db, agentB.projectId, { title: 'Other artifact' });

    const getRes = await request(app)
      .get(`/api/context-artifacts/${otherArtifactId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(getRes.status).toBe(404);

    const linkRes = await request(app)
      .post(`/api/context-artifacts/${ownArtifactId}/link`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ to_artifact_id: otherArtifactId, link_type: 'references' });
    expect(linkRes.status).toBe(403);
  });

  test('agent cannot read local PRs from another project', async () => {
    const { agentA, agentB } = setupTwoProjectAgents(db);
    const prId = generateId();
    db.prepare(
      `INSERT INTO local_prs (id, project_id, title, status) VALUES (?, ?, 'Other PR', 'draft')`,
    ).run(prId, agentB.projectId);

    const getRes = await request(app)
      .get(`/api/local-prs/${prId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app)
      .get(`/api/local-prs?project_id=${agentB.projectId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.local_prs).toEqual([]);
  });

  test('agent management and heartbeat are scoped to authenticated project', async () => {
    const { agentA, agentB } = setupTwoProjectAgents(db);
    const agentARow = getAgent(db, agentA.agentId);
    const otherTaskId = insertTask(db, agentB.projectId, { title: 'Other heartbeat task' });

    const listRes = await request(app)
      .get(`/api/agents?project_id=${agentB.projectId}`)
      .set('Authorization', `Bearer ${agentA.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.agents.every((agent) => agent.project_id === agentA.projectId)).toBe(true);

    await request(app)
      .get(`/api/agents/${agentB.agentId}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);

    await request(app)
      .post(`/api/agents/${agentB.agentId}/token/rotate`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);

    await request(app)
      .post(`/api/agents/${agentB.agentId}/revoke`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);

    const createRes = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({
        project_id: agentB.projectId,
        department_id: agentARow.department_id,
        role_instance_id: agentARow.role_instance_id,
        name: 'Scoped new agent',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.agent.project_id).toBe(agentA.projectId);

    await request(app)
      .post('/api/agents/heartbeat')
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ status: 'busy', current_task_id: otherTaskId })
      .expect(403);
  });

  test('engineer cannot spoof CEO to contact a human', async () => {
    const projectId = generateId();
    const departmentId = generateId();
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, 'Spoof Project', 'spoof-project', '/tmp/spoof', 'active')`,
    ).run(projectId);
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, 'core', 'Core')`,
    ).run(departmentId, projectId);

    const engineer = insertTestAgent(db, {
      project_id: projectId,
      department_id: departmentId,
      role_key: 'engineer',
      agent_name: 'Engineer',
    });
    const ceo = insertTestAgent(db, {
      project_id: projectId,
      department_id: departmentId,
      role_key: 'ceo',
      agent_name: 'CEO',
    });
    const engineerRow = getAgent(db, engineer.agentId);
    const ceoRow = getAgent(db, ceo.agentId);
    const humanId = generateId();
    db.prepare(`INSERT INTO humans (id, display_name, role) VALUES (?, 'Human', 'customer')`).run(
      humanId,
    );

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${engineer.token}`)
      .send({
        project_id: projectId,
        from_role_instance_id: ceoRow.role_instance_id,
        to_human_id: humanId,
        content_md: 'Spoofed hello',
        message_type: 'question',
      });
    expect(res.status).toBe(403);

    const stored = db.prepare('SELECT * FROM messages WHERE content_md = ?').get('Spoofed hello');
    expect(stored).toBeUndefined();
    expect(engineerRow.role_instance_id).not.toBe(ceoRow.role_instance_id);
  });

  test('messages and task events always use authenticated sender identity', async () => {
    const projectId = generateId();
    const departmentId = generateId();
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, 'Identity Project', 'identity-project', '/tmp/identity', 'active')`,
    ).run(projectId);
    db.prepare(
      `INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, 'core', 'Core')`,
    ).run(departmentId, projectId);

    const engineer = insertTestAgent(db, {
      project_id: projectId,
      department_id: departmentId,
      role_key: 'engineer',
    });
    const techLead = insertTestAgent(db, {
      project_id: projectId,
      department_id: departmentId,
      role_key: 'tech_lead',
    });
    const engineerRow = getAgent(db, engineer.agentId);
    const techLeadRow = getAgent(db, techLead.agentId);
    addRoleEdge(db, projectId, engineerRow.role_instance_id, techLeadRow.role_instance_id, {
      can_message: true,
    });

    const msgRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${engineer.token}`)
      .send({
        project_id: projectId,
        from_agent_id: techLead.agentId,
        from_role_instance_id: techLeadRow.role_instance_id,
        to_agent_id: techLead.agentId,
        to_role_instance_id: techLeadRow.role_instance_id,
        content_md: 'Real sender must be engineer',
        message_type: 'notification',
      });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.from_agent_id).toBe(engineer.agentId);
    expect(msgRes.body.message.from_role_instance_id).toBe(engineerRow.role_instance_id);

    const taskId = insertTask(db, projectId, { assigned_agent_id: engineer.agentId });
    const eventRes = await request(app)
      .post(`/api/tasks/${taskId}/events`)
      .set('Authorization', `Bearer ${engineer.token}`)
      .send({
        event_type: 'progress',
        content_md: 'Working',
        agent_id: techLead.agentId,
      });
    expect(eventRes.status).toBe(201);
    expect(eventRes.body.event.agent_id).toBe(engineer.agentId);
  });
});

describe('approved context and Crispy contract alignment', () => {
  let db, app, agent;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);
    agent = insertTestAgent(db, { role_key: 'engineer' });
  });

  afterEach(() => db.close());

  test('execution context is Crispy-compatible and approved-only for engineering tasks', async () => {
    const approvedMvp = insertArtifact(db, agent.projectId, {
      artifact_type: 'product_requirements',
      title: 'Approved MVP',
      content_md: 'Approved MVP requirements',
      status: 'approved',
      lifecycle_stage: 'mvp',
      version: 2,
    });
    const draftMvp = insertArtifact(db, agent.projectId, {
      artifact_type: 'acceptance_criteria',
      title: 'Draft MVP',
      content_md: 'Draft should not leak',
      status: 'draft',
      lifecycle_stage: 'mvp',
    });
    const archivedMvp = insertArtifact(db, agent.projectId, {
      title: 'Archived MVP',
      content_md: 'Archived should not leak',
      status: 'approved',
      lifecycle_stage: 'mvp',
      is_archived: 1,
    });
    const v1Artifact = insertArtifact(db, agent.projectId, {
      title: 'Approved v1',
      content_md: 'v1 should not leak into MVP',
      status: 'approved',
      lifecycle_stage: 'v1',
    });
    const taskId = insertTask(db, agent.projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
      lifecycle_stage: 'mvp',
      linked_artifact_ids_json: JSON.stringify([approvedMvp, draftMvp, archivedMvp, v1Artifact]),
    });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);

    expect(res.body.taskId).toBe(taskId);
    expect(res.body.description).toBe('Execute the task safely');
    expect(res.body.allowedTools).toBeDefined();
    expect(res.body.forbiddenActions).toBeDefined();
    expect(res.body.allowed_tools).toBeUndefined();
    expect(res.body.forbidden_actions).toBeUndefined();
    expect(res.body.dynamicContext).toContain('Approved MVP requirements');
    expect(res.body.dynamicContext).not.toContain('Draft should not leak');
    expect(res.body.dynamicContext).not.toContain('Archived should not leak');
    expect(res.body.dynamicContext).not.toContain('v1 should not leak into MVP');
    expect(res.body.sourceArtifacts).toEqual([
      expect.objectContaining({
        artifactId: approvedMvp,
        version: 2,
        status: 'approved',
        lifecycleStage: 'mvp',
      }),
    ]);
    assertCrispyParserAccepts(res.body);
  });

  test('review tasks may receive needs_review artifacts', async () => {
    const needsReview = insertArtifact(db, agent.projectId, {
      artifact_type: 'review_notes',
      title: 'Needs review',
      content_md: 'Review draft is visible',
      status: 'needs_review',
      lifecycle_stage: 'mvp',
    });
    const taskId = insertTask(db, agent.projectId, {
      assigned_agent_id: agent.agentId,
      status: 'in_progress',
      lifecycle_stage: 'mvp',
      title: 'Review context',
      linked_artifact_ids_json: JSON.stringify([needsReview]),
    });

    const res = await request(app)
      .get(`/api/tasks/${taskId}/execution-context`)
      .set('Authorization', `Bearer ${agent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.dynamicContext).toContain('Review draft is visible');
  });
});

describe('context revisions and document set snapshots', () => {
  let db, app, ceo;

  beforeEach(() => {
    db = createSeededTestDb();
    app = createTestApp(db);
    ceo = insertTestAgent(db, { role_key: 'ceo', agent_name: 'CEO' });
  });

  afterEach(() => db.close());

  test('PATCH content changes create a new context revision', async () => {
    const artifactId = insertArtifact(db, ceo.projectId, {
      content_md: 'v1 content',
      status: 'draft',
    });

    const res = await request(app)
      .patch(`/api/context-artifacts/${artifactId}`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ content_md: 'v2 content', change_summary_md: 'Clarified scope' });
    expect(res.status).toBe(200);
    expect(res.body.artifact.version).toBe(2);

    const revisions = db
      .prepare('SELECT * FROM context_revisions WHERE artifact_id = ? ORDER BY version')
      .all(artifactId);
    expect(revisions).toHaveLength(2);
    expect(revisions[0].content_md).toBe('v1 content');
    expect(revisions[1].content_md).toBe('v2 content');
    expect(revisions[1].change_summary_md).toBe('Clarified scope');
  });

  test('research note revisions preserve history', async () => {
    const sessionId = generateId();
    const humanId = generateId();
    const problemId = generateId();
    db.prepare(`INSERT INTO humans (id, display_name, role) VALUES (?, 'Human', 'customer')`).run(
      humanId,
    );
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status)
       VALUES (?, ?, ?, 'Problem', 'Problem', 'in_alignment')`,
    ).run(problemId, ceo.projectId, humanId);
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status)
       VALUES (?, ?, ?, 'Session', 'active')`,
    ).run(sessionId, ceo.projectId, problemId);

    const createRes = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/research-notes`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ title: 'Research', content_md: 'v1 research' });
    expect(createRes.status).toBe(201);
    const noteId = createRes.body.research_note.id;

    const patchRes = await request(app)
      .patch(`/api/research-notes/${noteId}`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ content_md: 'v2 research', change_summary_md: 'Added source' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.research_note.version).toBe(2);

    const revisions = db
      .prepare('SELECT * FROM research_note_revisions WHERE research_note_id = ? ORDER BY version')
      .all(noteId);
    expect(revisions).toHaveLength(2);
    expect(revisions[0].content_md).toBe('v1 research');
    expect(revisions[1].content_md).toBe('v2 research');
  });

  test('approved document set stores artifact version snapshot', async () => {
    const artifactId = insertArtifact(db, ceo.projectId, {
      artifact_type: 'product_requirements',
      title: 'MVP PRD',
      content_md: 'v1 docs',
      version: 1,
    });
    const dsRes = await request(app)
      .post(`/api/projects/${ceo.projectId}/document-sets`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ name: 'MVP Set', stage: 'mvp' });
    expect(dsRes.status).toBe(201);
    const documentSetId = dsRes.body.document_set.id;

    await request(app)
      .post(`/api/document-sets/${documentSetId}/items`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ artifact_ids: [artifactId] })
      .expect(201);

    await request(app)
      .post(`/api/document-sets/${documentSetId}/approve`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .expect(200);

    await request(app)
      .post(`/api/context-artifacts/${artifactId}/revise`)
      .set('Authorization', `Bearer ${ceo.token}`)
      .send({ content_md: 'v2 docs', change_summary_md: 'Future scope' })
      .expect(200);

    const getRes = await request(app)
      .get(`/api/document-sets/${documentSetId}`)
      .set('Authorization', `Bearer ${ceo.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.items[0].artifact_version).toBe(1);
    expect(getRes.body.items[0].artifact_current_version).toBe(2);
  });
});
