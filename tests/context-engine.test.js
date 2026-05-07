const request = require('supertest');
const { createSeededTestDb, createTestApp, insertTestAgent } = require('./helpers');
const { generateId } = require('../src/db/helpers');

function setupAuthApp(db) {
  const app = createTestApp(db);
  const { token, projectId } = insertTestAgent(db, { role_key: 'ceo', agent_name: 'CEO' });
  return { app, token, projectId };
}

function insertTestProject(db, slug) {
  if (!slug) {
    const existing = db.prepare('SELECT id FROM projects ORDER BY created_at LIMIT 1').get();
    if (existing) return existing.id;
  }
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

function insertTestHuman(db) {
  const humanId = generateId();
  db.prepare(`INSERT INTO humans (id, display_name, role) VALUES (?, ?, ?)`).run(
    humanId,
    'Test Human',
    'customer',
  );
  return humanId;
}

function insertTestAlignmentSession(db, projectId, humanId) {
  const psId = generateId();
  db.prepare(
    `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(psId, projectId, humanId, 'Test', 'Content', 'in_alignment');
  const sessionId = generateId();
  db.prepare(
    `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status) VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, projectId, psId, 'Test Session', 'active');
  return sessionId;
}

function setupFull(db, projectIdOverride) {
  const projectId = projectIdOverride || insertTestProject(db);
  const humanId = insertTestHuman(db);
  const sessionId = insertTestAlignmentSession(db, projectId, humanId);
  return { projectId, humanId, sessionId };
}

function createArtifactViaApi(app, token, projectId, overrides = {}) {
  return request(app)
    .post('/api/context-artifacts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      project_id: projectId,
      artifact_type: 'product_requirements',
      title: 'Test Artifact',
      content_md: '# Requirements\nSome requirements here.',
      lifecycle_stage: 'mvp',
      ...overrides,
    });
}

// ─── Context Artifact CRUD Tests ──────────────────────────────────────────

describe('Context Artifact CRUD', () => {
  let db, app, token, projectId, humanId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId, humanId, sessionId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('POST creates a context artifact', async () => {
    const res = await createArtifactViaApi(app, token, projectId, {
      alignment_session_id: sessionId,
      author_human_id: humanId,
    });
    expect(res.status).toBe(201);
    expect(res.body.artifact.artifact_type).toBe('product_requirements');
    expect(res.body.artifact.status).toBe('draft');
    expect(res.body.artifact.version).toBe(1);
    expect(res.body.artifact.lifecycle_stage).toBe('mvp');
    expect(res.body.artifact.project_id).toBe(projectId);
  });

  test('POST validates required fields', async () => {
    const res = await request(app)
      .post('/api/context-artifacts')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST validates artifact_type', async () => {
    const res = await request(app)
      .post('/api/context-artifacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_id: projectId,
        artifact_type: 'invalid_type',
        title: 'Bad type',
        content_md: 'content',
      });
    expect(res.status).toBe(400);
  });

  test('GET retrieves artifact by id', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .get(`/api/context-artifacts/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.artifact.id).toBe(id);
    expect(res.body.artifact.title).toBe('Test Artifact');
  });

  test('GET returns 404 for missing artifact', async () => {
    const res = await request(app)
      .get(`/api/context-artifacts/${generateId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('PATCH updates artifact', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .patch(`/api/context-artifacts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title', content_md: 'Updated content' });
    expect(res.status).toBe(200);
    expect(res.body.artifact.title).toBe('Updated Title');
    expect(res.body.artifact.content_md).toBe('Updated content');
  });

  test('GET lists artifacts by project', async () => {
    await createArtifactViaApi(app, token, projectId, { title: 'Artifact 1' });
    await createArtifactViaApi(app, token, projectId, {
      title: 'Artifact 2',
      artifact_type: 'architecture_spec',
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts.length).toBe(2);
  });

  test('GET lists artifacts by project with type filter', async () => {
    await createArtifactViaApi(app, token, projectId, {
      title: 'PRD',
      artifact_type: 'product_requirements',
    });
    await createArtifactViaApi(app, token, projectId, {
      title: 'Arch',
      artifact_type: 'architecture_spec',
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts?artifact_type=product_requirements`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts.length).toBe(1);
    expect(res.body.artifacts[0].artifact_type).toBe('product_requirements');
  });

  test('APIs reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/context-artifacts')
      .send({ project_id: projectId, artifact_type: 'test', title: 'T', content_md: 'C' });
    expect(res.status).toBe(401);
  });
});

// ─── Artifact Status Tests ────────────────────────────────────────────────

describe('Artifact Status Transitions', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('approve changes status to approved', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.artifact.status).toBe('approved');
  });

  test('reject changes status to rejected', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Missing requirements' });
    expect(res.status).toBe(200);
    expect(res.body.artifact.status).toBe('rejected');
  });

  test('archive marks artifact as archived', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.artifact.is_archived).toBe(1);
  });

  test('archived artifacts are excluded from default listing', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    await request(app)
      .post(`/api/context-artifacts/${createRes.body.artifact.id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.artifacts.length).toBe(0);
  });

  test('archived artifacts included when requested', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    await request(app)
      .post(`/api/context-artifacts/${createRes.body.artifact.id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts?include_archived=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.artifacts.length).toBe(1);
  });
});

// ─── Revision Tests ───────────────────────────────────────────────────────

describe('Artifact Revision', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('revise creates new version with revision record', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content_md: '# Updated Requirements\nNew content.',
        change_summary_md: 'Added new requirements section.',
      });
    expect(res.status).toBe(200);
    expect(res.body.artifact.version).toBe(2);
    expect(res.body.artifact.content_md).toBe('# Updated Requirements\nNew content.');
    expect(res.body.revision.version).toBe(2);
    expect(res.body.revision.change_summary_md).toBe('Added new requirements section.');
  });

  test('multiple revisions increment version', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'v2', change_summary_md: 'second' });

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'v3', change_summary_md: 'third' });
    expect(res.body.artifact.version).toBe(3);
  });

  test('revision history is preserved', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'v2 content', change_summary_md: 'second' });

    await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'v3 content', change_summary_md: 'third' });

    const res = await request(app)
      .get(`/api/context-artifacts/${id}/revisions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(3);
    expect(res.body.revisions[0].version).toBe(1);
    expect(res.body.revisions[0].change_summary_md).toBe('Initial version');
    expect(res.body.revisions[1].version).toBe(2);
    expect(res.body.revisions[2].version).toBe(3);
  });
});

// ─── Superseding Tests ────────────────────────────────────────────────────

describe('Artifact Superseding', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('superseded artifact is not selected as latest', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      lifecycle_stage: 'mvp',
    });
    const oldId = createRes.body.artifact.id;

    // Approve the old one
    await request(app)
      .post(`/api/context-artifacts/${oldId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Create new one that supersedes
    const res = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      lifecycle_stage: 'mvp',
      title: 'Updated PRD v2',
      supersedes_artifact_id: oldId,
    });
    expect(res.status).toBe(201);
    expect(res.body.artifact.supersedes_artifact_id).toBe(oldId);

    // Old artifact should be superseded
    const oldArtifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(oldId);
    expect(oldArtifact.status).toBe('superseded');
  });
});

// ─── Context Links Tests ──────────────────────────────────────────────────

describe('Context Links', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('link two artifacts', async () => {
    const a1 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'PRD',
    });
    const a2 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'architecture_spec',
      title: 'Arch Spec',
    });

    const res = await request(app)
      .post(`/api/context-artifacts/${a1.body.artifact.id}/link`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to_artifact_id: a2.body.artifact.id,
        link_type: 'drives',
      });
    expect(res.status).toBe(201);
    expect(res.body.link.link_type).toBe('drives');
    expect(res.body.link.from_artifact_id).toBe(a1.body.artifact.id);
    expect(res.body.link.to_artifact_id).toBe(a2.body.artifact.id);
  });

  test('get linked artifacts', async () => {
    const a1 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'PRD',
    });
    const a2 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'architecture_spec',
      title: 'Arch Spec',
    });

    await request(app)
      .post(`/api/context-artifacts/${a1.body.artifact.id}/link`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        to_artifact_id: a2.body.artifact.id,
        link_type: 'references',
      });

    const res = await request(app)
      .get(`/api/context-artifacts/${a1.body.artifact.id}/links`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.links.length).toBe(1);
    expect(res.body.links[0].to_artifact_id).toBe(a2.body.artifact.id);
  });
});

// ─── Lifecycle Guard Tests ────────────────────────────────────────────────

describe('Lifecycle Guards', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('cannot revise an archived artifact', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'new content', change_summary_md: 'try revise' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('archived');
  });

  test('cannot revise a superseded artifact', async () => {
    const old = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      lifecycle_stage: 'mvp',
      title: 'Old PRD',
    });
    const oldId = old.body.artifact.id;

    // Approve it first, then supersede
    await request(app)
      .post(`/api/context-artifacts/${oldId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Create new artifact that supersedes
    await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      lifecycle_stage: 'mvp',
      title: 'New PRD',
      supersedes_artifact_id: oldId,
    });

    // Try to revise the superseded one
    const res = await request(app)
      .post(`/api/context-artifacts/${oldId}/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content_md: 'try', change_summary_md: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('superseded');
  });

  test('cannot approve an archived artifact', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('archived');
  });

  test('cannot approve a superseded artifact', async () => {
    const old = await createArtifactViaApi(app, token, projectId, {
      title: 'Old',
    });
    await createArtifactViaApi(app, token, projectId, {
      title: 'New',
      supersedes_artifact_id: old.body.artifact.id,
    });

    const res = await request(app)
      .post(`/api/context-artifacts/${old.body.artifact.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('superseded');
  });

  test('double-approve is idempotent', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.artifact.status).toBe('approved');
  });

  test('double-archive is idempotent', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    await request(app)
      .post(`/api/context-artifacts/${id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .post(`/api/context-artifacts/${id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.artifact.is_archived).toBe(1);
  });

  test('superseding across projects is rejected', async () => {
    const otherProjectId = insertTestProject(db, 'other-proj');

    // Create artifact in other project directly in DB
    const otherArtifactId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'Other', 'content', 'approved', 'mvp', 1)`,
    ).run(otherArtifactId, otherProjectId);

    // Try to supersede from different project
    const res = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      lifecycle_stage: 'mvp',
      title: 'Try supersede',
      supersedes_artifact_id: otherArtifactId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('different project');
  });

  test('PATCH does not allow direct status changes', async () => {
    const createRes = await createArtifactViaApi(app, token, projectId);
    const id = createRes.body.artifact.id;

    const res = await request(app)
      .patch(`/api/context-artifacts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    // status should be ignored — not in allowed fields
    expect(res.status).toBe(200);
    expect(res.body.artifact.status).toBe('draft');
  });
});

// ─── Document Set Tests ───────────────────────────────────────────────────

describe('Document Sets', () => {
  let db, app, token, projectId, sessionId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId, sessionId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('create a document set', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'MVP Document Set',
        stage: 'mvp',
        alignment_session_id: sessionId,
      });
    expect(res.status).toBe(201);
    expect(res.body.document_set.name).toBe('MVP Document Set');
    expect(res.body.document_set.stage).toBe('mvp');
    expect(res.body.document_set.status).toBe('draft');
  });

  test('add artifacts to document set', async () => {
    const dsRes = await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MVP Docs', stage: 'mvp' });

    const dsId = dsRes.body.document_set.id;

    const a1 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'customer_brief',
      title: 'Brief',
    });
    const a2 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'acceptance_criteria',
      title: 'AC',
    });

    const res = await request(app)
      .post(`/api/document-sets/${dsId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        artifact_ids: [a1.body.artifact.id, a2.body.artifact.id],
      });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(2);
  });

  test('list document sets for project', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MVP', stage: 'mvp' });
    await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'V1', stage: 'v1' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.document_sets.length).toBe(2);
  });

  test('get document set with items', async () => {
    const dsRes = await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MVP', stage: 'mvp' });
    const dsId = dsRes.body.document_set.id;

    const a1 = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'PRD',
    });
    await request(app)
      .post(`/api/document-sets/${dsId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ artifact_ids: [a1.body.artifact.id] });

    const res = await request(app)
      .get(`/api/document-sets/${dsId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.document_set.name).toBe('MVP');
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].artifact_id).toBe(a1.body.artifact.id);
  });

  test('approve a document set', async () => {
    const dsRes = await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MVP', stage: 'mvp' });
    const dsId = dsRes.body.document_set.id;

    const res = await request(app)
      .post(`/api/document-sets/${dsId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.document_set.status).toBe('approved');
  });

  test('MVP and v1 docs can coexist', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MVP', stage: 'mvp' });
    await request(app)
      .post(`/api/projects/${projectId}/document-sets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'V1', stage: 'v1' });

    await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'MVP PRD',
      lifecycle_stage: 'mvp',
    });
    await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'V1 PRD',
      lifecycle_stage: 'v1',
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.artifacts.length).toBe(1);
    expect(res.body.artifacts[0].title).toBe('MVP PRD');

    const res2 = await request(app)
      .get(`/api/projects/${projectId}/context-artifacts?lifecycle_stage=v1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res2.body.artifacts.length).toBe(1);
    expect(res2.body.artifacts[0].title).toBe('V1 PRD');
  });
});

// ─── Context Search Tests ─────────────────────────────────────────────────

describe('Context Search', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    const result = insertTestAgent(db);
    token = result.token;
    projectId = result.projectId;
    app = createTestApp(db);
  });

  afterEach(() => {
    db.close();
  });

  test('search artifacts by query scoped to agent project', async () => {
    db.prepare(
      `INSERT INTO context_artifacts
       (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'Product Requirements for Todo App',
               'Build a todo application with CRUD.', 'approved', 'mvp', 1)`,
    ).run(generateId(), projectId);
    db.prepare(
      `INSERT INTO context_artifacts
       (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'architecture_spec', 'Architecture Spec',
               'Use microservices architecture for the todo app.', 'approved', 'mvp', 1)`,
    ).run(generateId(), projectId);

    const res = await request(app)
      .get('/api/context?q=todo')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts.length).toBe(2);
  });

  test('search does not return artifacts from other projects', async () => {
    // Create artifact in agent's project
    await createArtifactViaApi(app, token, projectId, {
      title: 'My Project Requirements',
      content_md: 'My project content.',
    });

    // Create artifact in different project directly in DB
    const otherProjectId = insertTestProject(db, 'other');
    const otherId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'Other Project', 'todo secret stuff', 'approved', 'mvp', 1)`,
    ).run(otherId, otherProjectId);

    const res = await request(app)
      .get('/api/context?q=todo')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts.length).toBe(0);
  });
});

// ─── Source-of-Truth Validation Tests ─────────────────────────────────────

describe('Source-of-Truth Validation', () => {
  let db, app, token, projectId;

  beforeEach(() => {
    db = createSeededTestDb();
    ({ app, token } = setupAuthApp(db));
    ({ projectId } = setupFull(db));
  });

  afterEach(() => {
    db.close();
  });

  test('blocks task without approved requirements', async () => {
    await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'Draft PRD',
      lifecycle_stage: 'mvp',
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/validate-source-of-truth`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lifecycle_stage: 'mvp' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.missing).toContain('approved_product_requirements');
  });

  test('passes with approved requirements and acceptance criteria', async () => {
    const prd = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'PRD',
      lifecycle_stage: 'mvp',
    });
    await request(app)
      .post(`/api/context-artifacts/${prd.body.artifact.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const ac = await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'acceptance_criteria',
      title: 'AC',
      lifecycle_stage: 'mvp',
    });
    await request(app)
      .post(`/api/context-artifacts/${ac.body.artifact.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const res = await request(app)
      .post(`/api/projects/${projectId}/validate-source-of-truth`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lifecycle_stage: 'mvp' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.missing.length).toBe(0);
  });

  test('draft artifacts not used for validation', async () => {
    await createArtifactViaApi(app, token, projectId, {
      artifact_type: 'product_requirements',
      title: 'Draft PRD',
      lifecycle_stage: 'mvp',
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/validate-source-of-truth`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lifecycle_stage: 'mvp' });
    expect(res.body.valid).toBe(false);
  });
});

// ─── Prompt Assembler Dynamic Context Tests ───────────────────────────────

describe('Prompt Assembler Dynamic Context', () => {
  let db, app, token, projectId, agentId;

  beforeEach(() => {
    db = createSeededTestDb();
    const result = insertTestAgent(db);
    token = result.token;
    agentId = result.agentId;
    app = createTestApp(db);
    projectId = result.projectId;
    insertTestHuman(db);
  });

  afterEach(() => {
    db.close();
  });

  test('prompt includes approved dynamic context', async () => {
    // Create and approve artifacts
    const prdId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'PRD', '# PRD Content', 'approved', 'mvp', 1)`,
    ).run(prdId, projectId);

    const acId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'acceptance_criteria', 'AC', '# AC Content', 'approved', 'mvp', 1)`,
    ).run(acId, projectId);

    const res = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const dynamicContext = res.body.bundle.dynamic_context;
    expect(dynamicContext).toBeDefined();
    expect(dynamicContext.length).toBeGreaterThanOrEqual(2);

    const types = dynamicContext.map((c) => c.artifact_type);
    expect(types).toContain('product_requirements');
    expect(types).toContain('acceptance_criteria');
  });

  test('prompt excludes archived artifacts', async () => {
    const prdId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version, is_archived)
       VALUES (?, ?, 'product_requirements', 'Old PRD', '# Old', 'approved', 'mvp', 1, 1)`,
    ).run(prdId, projectId);

    const res = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const types = (res.body.bundle.dynamic_context || []).map((c) => c.artifact_type);
    expect(types).not.toContain('product_requirements');
  });

  test('prompt excludes superseded artifacts', async () => {
    const prdId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'Old PRD', '# Old', 'superseded', 'mvp', 1)`,
    ).run(prdId, projectId);

    const res = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const types = (res.body.bundle.dynamic_context || []).map((c) => c.artifact_type);
    expect(types).not.toContain('product_requirements');
  });

  test('prompt selects latest approved artifact per type', async () => {
    // Old approved PRD
    const oldId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'product_requirements', 'Old PRD', '# Old Content', 'superseded', 'mvp', 1)`,
    ).run(oldId, projectId);

    // New approved PRD
    const newId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version, supersedes_artifact_id)
       VALUES (?, ?, 'product_requirements', 'New PRD', '# New Content', 'approved', 'mvp', 2, ?)`,
    ).run(newId, projectId, oldId);

    const res = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const prds = (res.body.bundle.dynamic_context || []).filter(
      (c) => c.artifact_type === 'product_requirements',
    );
    expect(prds.length).toBe(1);
    expect(prds[0].title).toBe('New PRD');
  });

  test('prompt includes draft only when explicitly requested', async () => {
    const draftId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts (id, project_id, artifact_type, title, content_md, status, lifecycle_stage, version)
       VALUES (?, ?, 'research_note', 'Draft Research', '# Draft', 'draft', 'mvp', 1)`,
    ).run(draftId, projectId);

    // Without include_draft
    const res1 = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp`)
      .set('Authorization', `Bearer ${token}`);
    const types1 = (res1.body.bundle.dynamic_context || []).map((c) => c.artifact_type);
    expect(types1).not.toContain('research_note');

    // With include_draft
    const res2 = await request(app)
      .get(`/api/agents/${agentId}/prompt-preview?lifecycle_stage=mvp&include_draft=true`)
      .set('Authorization', `Bearer ${token}`);
    const types2 = (res2.body.bundle.dynamic_context || []).map((c) => c.artifact_type);
    expect(types2).toContain('research_note');
  });
});
