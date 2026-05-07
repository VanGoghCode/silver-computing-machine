const request = require('supertest');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { generateId } = require('../src/db/helpers');

function setupAuthApp(db) {
  const app = createTestApp(db);
  const { token } = insertTestAgent(db);
  return { app, token };
}

function insertTestProject(db, slug) {
  const projectId = generateId();
  db.prepare(`INSERT INTO projects (id, name, slug, root_path, status) VALUES (?, ?, ?, ?, ?)`).run(
    projectId,
    'Test Project',
    slug || `test-proj-${projectId.slice(0, 8)}`,
    `/workspace/${slug || projectId.slice(0, 8)}`,
    'active',
  );
  return projectId;
}

function insertTestDepartment(db, projectId, key) {
  const deptId = generateId();
  db.prepare(`INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`).run(
    deptId,
    projectId,
    key,
    key.charAt(0).toUpperCase() + key.slice(1),
  );
  return deptId;
}

function insertTestRoleInstance(db, projectId, deptId, roleKey, displayName) {
  const template = db.prepare(`SELECT * FROM role_templates WHERE key = ?`).get(roleKey);
  const nodeId = generateId();
  db.prepare(
    `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
  ).run(nodeId, projectId, deptId, template.id, displayName || template.display_name);
  return nodeId;
}

function insertTestHuman(db) {
  const humanId = generateId();
  db.prepare(`INSERT INTO humans (id, display_name, role) VALUES (?, ?, ?)`).run(
    humanId,
    'Test Human',
    'customer',
  );
  return humanId;
}

function setupFullProject(db) {
  const projectId = insertTestProject(db);
  const humanId = insertTestHuman(db);
  const deptIds = {
    frontend: insertTestDepartment(db, projectId, 'frontend'),
    backend: insertTestDepartment(db, projectId, 'backend'),
    infra: insertTestDepartment(db, projectId, 'infra'),
    deployment: insertTestDepartment(db, projectId, 'deployment'),
  };
  const roleInstances = {};
  for (const [deptKey, deptId] of Object.entries(deptIds)) {
    roleInstances[deptKey] = {};
    const roles = ['ceo', 'cto', 'product_manager'];
    if (deptKey === 'frontend') roles.push('engineer');
    if (deptKey === 'backend') roles.push('engineer', 'tech_lead');
    if (deptKey === 'infra') roles.push('architect');
    if (deptKey === 'deployment') roles.push('git_manager');
    for (const roleKey of roles) {
      roleInstances[deptKey][roleKey] = insertTestRoleInstance(db, projectId, deptId, roleKey);
    }
  }
  return { projectId, humanId, deptIds, roleInstances };
}

// ─── Problem Statement Tests ────────────────────────────────────────────────

describe('Problem Statement API', () => {
  let db, app, token, projectId, humanId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    projectId = insertTestProject(db);
    humanId = insertTestHuman(db);
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates a problem statement', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/problem-statements`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        human_id: humanId,
        title: 'Build a todo app',
        content_md: 'I need a simple todo application with CRUD operations.',
      });
    expect(res.status).toBe(201);
    expect(res.body.problem_statement.title).toBe('Build a todo app');
    expect(res.body.problem_statement.status).toBe('draft');
    expect(res.body.problem_statement.project_id).toBe(projectId);
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/problem-statements`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET lists problem statements for a project', async () => {
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'draft');

    const res = await request(app)
      .get(`/api/projects/${projectId}/problem-statements`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.problem_statements.length).toBe(1);
    expect(res.body.problem_statements[0].id).toBe(psId);
  });

  test('GET single problem statement by id', async () => {
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'submitted');

    const res = await request(app)
      .get(`/api/problem-statements/${psId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.problem_statement.title).toBe('Test');
    expect(res.body.problem_statement.status).toBe('submitted');
  });

  test('GET returns 404 for missing problem statement', async () => {
    const res = await request(app)
      .get(`/api/problem-statements/${generateId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('PATCH updates problem statement', async () => {
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Original', 'Original content', 'draft');

    const res = await request(app)
      .patch(`/api/problem-statements/${psId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'submitted', content_md: 'Updated content' });
    expect(res.status).toBe(200);
    expect(res.body.problem_statement.status).toBe('submitted');
    expect(res.body.problem_statement.content_md).toBe('Updated content');
  });

  test('APIs reject unauthenticated requests', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/problem-statements`)
      .send({ human_id: humanId, title: 'Test', content_md: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ─── Alignment Session Tests ────────────────────────────────────────────────

describe('Alignment Session API', () => {
  let db, app, token, projectId, humanId, psId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
    psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test Problem', 'Test content', 'submitted');
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates alignment session with CEO/CTO/PM participants', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/alignment-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        problem_statement_id: psId,
        title: 'Initial Alignment',
      });
    expect(res.status).toBe(201);
    expect(res.body.session.title).toBe('Initial Alignment');
    expect(res.body.session.status).toBe('active');
    expect(res.body.session.current_round).toBe(1);

    // Check participants include CEO, CTO, Product Manager roles
    const participants = res.body.participants;
    const roleKeys = participants.map((p) => p.role_key);
    expect(roleKeys).toContain('ceo');
    expect(roleKeys).toContain('cto');
    expect(roleKeys).toContain('product_manager');
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/alignment-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET lists alignment sessions for project', async () => {
    const sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');

    const res = await request(app)
      .get(`/api/projects/${projectId}/alignment-sessions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(1);
  });

  test('GET single alignment session', async () => {
    const sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');

    const res = await request(app)
      .get(`/api/alignment-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.session.title).toBe('Test Session');
  });

  test('PATCH updates alignment session status', async () => {
    const sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');

    const res = await request(app)
      .patch(`/api/alignment-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'waiting_for_human' });
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('waiting_for_human');
  });

  test('problem statement status updates to in_alignment when session created', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/alignment-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ problem_statement_id: psId, title: 'Alignment' });

    const ps = db.prepare(`SELECT * FROM problem_statements WHERE id = ?`).get(psId);
    expect(ps.status).toBe('in_alignment');
  });
});

// ─── Clarification Question Tests ───────────────────────────────────────────

describe('Clarification Question Cycle', () => {
  let db, app, token, projectId, humanId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test Problem', 'Content', 'in_alignment');
    sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates a note-type question', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_human_id: humanId,
        question_md: 'What is the target platform?',
        question_type: 'note',
      });
    expect(res.status).toBe(201);
    expect(res.body.question.question_type).toBe('note');
    expect(res.body.question.status).toBe('open');
    expect(res.body.question.round_number).toBe(1);
  });

  test('POST creates an MCQ question with options', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_human_id: humanId,
        question_md: 'Which platform do you prefer?',
        question_type: 'mcq_single',
        options_json: JSON.stringify(['Web', 'Mobile', 'Desktop']),
      });
    expect(res.status).toBe(201);
    expect(res.body.question.question_type).toBe('mcq_single');
    expect(res.body.question.options_json).toBeTruthy();
  });

  test('GET lists questions for session', async () => {
    const qId = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(qId, sessionId, humanId, 'Test Q', 'note', 'open', 1);

    const res = await request(app)
      .get(`/api/alignment-sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBe(1);
  });

  test('POST answer stores the answer and marks question answered', async () => {
    const qId = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(qId, sessionId, humanId, 'Platform?', 'note', 'open', 1);

    const res = await request(app)
      .post(`/api/questions/${qId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answered_by_human_id: humanId,
        answer_md: 'I want a web application.',
      });
    expect(res.status).toBe(201);
    expect(res.body.answer.answer_md).toBe('I want a web application.');

    // Verify question is marked answered
    const q = db.prepare(`SELECT * FROM clarification_questions WHERE id = ?`).get(qId);
    expect(q.status).toBe('answered');
    expect(q.answered_at).toBeTruthy();
  });

  test('POST answer with selected_options_json for MCQ', async () => {
    const qId = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, options_json, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(qId, sessionId, humanId, 'Which?', 'mcq_single', JSON.stringify(['A', 'B']), 'open', 1);

    const res = await request(app)
      .post(`/api/questions/${qId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answered_by_human_id: humanId,
        answer_md: 'I pick A',
        selected_options_json: JSON.stringify(['A']),
      });
    expect(res.status).toBe(201);
    expect(res.body.answer.selected_options_json).toBeTruthy();
  });

  test('GET lists answers for session', async () => {
    const qId = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(qId, sessionId, humanId, 'Q', 'note', 'answered', 1);
    db.prepare(
      `INSERT INTO clarification_answers (id, question_id, answered_by_human_id, answer_md) VALUES (?, ?, ?, ?)`,
    ).run(generateId(), qId, humanId, 'My answer');

    const res = await request(app)
      .get(`/api/alignment-sessions/${sessionId}/answers`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.answers.length).toBe(1);
  });

  test('repeated question/answer rounds increment round_number', async () => {
    // Round 1
    const q1 = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(q1, sessionId, humanId, 'Q1', 'note', 'answered', 1);

    // Round 2
    const q2 = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(q2, sessionId, humanId, 'Q2', 'note', 'open', 2);

    const res = await request(app)
      .get(`/api/alignment-sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.questions.length).toBe(2);
    expect(res.body.questions[0].round_number).toBe(1);
    expect(res.body.questions[1].round_number).toBe(2);
  });

  test('POST validates required fields for question', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST validates required fields for answer', async () => {
    const qId = generateId();
    db.prepare(
      `INSERT INTO clarification_questions (id, alignment_session_id, target_human_id, question_md, question_type, status, round_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(qId, sessionId, humanId, 'Q', 'note', 'open', 1);

    const res = await request(app)
      .post(`/api/questions/${qId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Research Notes Tests ───────────────────────────────────────────────────

describe('Research Notes API', () => {
  let db, app, token, projectId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, setup.humanId, 'Test', 'Content', 'in_alignment');
    sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates a research note', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/research-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Codebase research findings',
        content_md: 'Found 3 existing modules related to the feature.',
        source_refs_json: JSON.stringify([{ type: 'codebase', path: 'src/modules/' }]),
        confidence: 0.85,
      });
    expect(res.status).toBe(201);
    expect(res.body.research_note.title).toBe('Codebase research findings');
    expect(res.body.research_note.confidence).toBe(0.85);
    expect(res.body.research_note.project_id).toBe(projectId);
  });

  test('GET lists research notes for session', async () => {
    db.prepare(
      `INSERT INTO research_notes (id, project_id, alignment_session_id, title, content_md) VALUES (?, ?, ?, ?, ?)`,
    ).run(generateId(), projectId, sessionId, 'Note 1', 'Content 1');

    const res = await request(app)
      .get(`/api/alignment-sessions/${sessionId}/research-notes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.research_notes.length).toBe(1);
  });

  test('PATCH updates research note', async () => {
    const noteId = generateId();
    db.prepare(
      `INSERT INTO research_notes (id, project_id, alignment_session_id, title, content_md) VALUES (?, ?, ?, ?, ?)`,
    ).run(noteId, projectId, sessionId, 'Draft Note', 'Initial content');

    const res = await request(app)
      .patch(`/api/research-notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'Updated research content', confidence: 0.9 });
    expect(res.status).toBe(200);
    expect(res.body.research_note.content_md).toBe('Updated research content');
    expect(res.body.research_note.confidence).toBe(0.9);
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/research-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Alignment Review Tests ─────────────────────────────────────────────────

describe('Alignment Review API', () => {
  let db, app, token, projectId, humanId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'in_alignment');
    sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates review saying more questions needed', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        review_md: 'Partial understanding. Need more info about deployment target.',
        missing_info_md: 'Deployment target, budget constraints',
        next_questions_needed: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.review.next_questions_needed).toBe(1);
    expect(res.body.review.missing_info_md).toBeTruthy();

    // Session stays active (not ready_for_docs)
    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(sessionId);
    expect(session.status).toBe('active');
  });

  test('POST review can mark ready_for_docs', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        review_md: 'Full understanding achieved.',
        missing_info_md: '',
        next_questions_needed: 0,
      });
    expect(res.status).toBe(201);
    expect(res.body.review.next_questions_needed).toBe(0);

    // Session should move to ready_for_docs
    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(sessionId);
    expect(session.status).toBe('ready_for_docs');
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post(`/api/alignment-sessions/${sessionId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Human Approval Tests ───────────────────────────────────────────────────

describe('Human Approval API', () => {
  let db, app, token, projectId, humanId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'in_alignment');
    sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'ready_for_docs');
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates a pending approval for an artifact', async () => {
    const artifactId = generateId();
    const res = await request(app)
      .post(`/api/projects/${projectId}/approvals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        alignment_session_id: sessionId,
        artifact_id: artifactId,
        human_id: humanId,
        approval_type: 'customer_brief',
      });
    expect(res.status).toBe(201);
    expect(res.body.approval.status).toBe('pending');
    expect(res.body.approval.approval_type).toBe('customer_brief');
  });

  test('PATCH approves an artifact', async () => {
    const approvalId = generateId();
    db.prepare(
      `INSERT INTO human_approvals (id, project_id, alignment_session_id, human_id, approval_type, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(approvalId, projectId, sessionId, humanId, 'product_requirements', 'pending');

    const res = await request(app)
      .patch(`/api/approvals/${approvalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved', notes_md: 'Looks good' });
    expect(res.status).toBe(200);
    expect(res.body.approval.status).toBe('approved');
  });

  test('PATCH rejects an artifact', async () => {
    const approvalId = generateId();
    db.prepare(
      `INSERT INTO human_approvals (id, project_id, alignment_session_id, human_id, approval_type, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(approvalId, projectId, sessionId, humanId, 'ceo_analysis', 'pending');

    const res = await request(app)
      .patch(`/api/approvals/${approvalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', notes_md: 'Missing key requirements' });
    expect(res.status).toBe(200);
    expect(res.body.approval.status).toBe('rejected');
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/approvals`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Context Artifact Integration Tests ─────────────────────────────────────

describe('Context Artifact Integration', () => {
  let db, app, token, projectId, humanId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'in_alignment');
    sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'ready_for_docs');
  });

  afterEach(() => {
    db.close();
  });

  test('draft context artifacts can be created from alignment session', async () => {
    const artifactTypes = [
      'customer_brief',
      'ceo_analysis',
      'cto_strategy',
      'product_requirements',
      'acceptance_criteria',
      'risk_register',
      'open_questions',
      'milestone_plan',
    ];

    for (const type of artifactTypes) {
      const res = await request(app)
        .post(`/api/projects/${projectId}/approvals`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          alignment_session_id: sessionId,
          artifact_id: generateId(),
          human_id: humanId,
          approval_type: type,
        });
      expect(res.status).toBe(201);
      expect(res.body.approval.approval_type).toBe(type);
      expect(res.body.approval.status).toBe('pending');
    }
  });
});

// ─── Engineering Task Gate Tests ────────────────────────────────────────────

describe('Engineering Task Gate', () => {
  let db, app, token, projectId, humanId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    const setup = setupFullProject(db);
    projectId = setup.projectId;
    humanId = setup.humanId;
  });

  afterEach(() => {
    db.close();
  });

  test('engineering tasks cannot be created from unapproved alignment docs', async () => {
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'in_alignment');
    const sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'active');

    // Try to check if engineering can proceed — should say no
    const res = await request(app)
      .get(`/api/projects/${projectId}/alignment-status`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.can_create_engineering_tasks).toBe(false);
  });

  test('engineering tasks can proceed when all docs are approved', async () => {
    const psId = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(psId, projectId, humanId, 'Test', 'Content', 'aligned');
    const sessionId = generateId();
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, projectId, psId, 'Test Session', 'approved');

    const res = await request(app)
      .get(`/api/projects/${projectId}/alignment-status`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.can_create_engineering_tasks).toBe(true);
  });
});
