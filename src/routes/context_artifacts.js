const express = require('express');
const { generateId } = require('../db/helpers');

const VALID_ARTIFACT_TYPES = [
  'customer_brief',
  'ceo_analysis',
  'cto_strategy',
  'product_requirements',
  'acceptance_criteria',
  'risk_register',
  'open_questions',
  'milestone_plan',
  'architecture_spec',
  'implementation_plan',
  'task_context',
  'decision_record',
  'review_notes',
  'test_report',
  'audit_report',
  'blocker_report',
  'daily_report',
  'research_note',
];

const VALID_LIFECYCLE_STAGES = ['discovery', 'mvp', 'v1', 'v2', 'future', 'maintenance'];

function createContextArtifactsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/context-artifacts
  router.post('/api/context-artifacts', (req, res) => {
    const { project_id, artifact_type, title, content_md } = req.body;

    if (!project_id || !artifact_type || !title || !content_md) {
      return res
        .status(400)
        .json({ error: 'project_id, artifact_type, title, and content_md are required' });
    }

    if (!VALID_ARTIFACT_TYPES.includes(artifact_type)) {
      return res.status(400).json({
        error: `Invalid artifact_type. Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      });
    }

    const lifecycleStage = req.body.lifecycle_stage || 'discovery';
    if (!VALID_LIFECYCLE_STAGES.includes(lifecycleStage)) {
      return res.status(400).json({
        error: `Invalid lifecycle_stage. Must be one of: ${VALID_LIFECYCLE_STAGES.join(', ')}`,
      });
    }

    const id = generateId();
    const supersedesId = req.body.supersedes_artifact_id || null;

    // If superseding, validate same project and mark the old artifact
    if (supersedesId) {
      const old = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(supersedesId);
      if (!old) {
        return res.status(400).json({ error: 'Artifact to supersede not found' });
      }
      if (old.project_id !== project_id) {
        return res.status(400).json({ error: 'Cannot supersede artifact from different project' });
      }
      db.prepare(
        "UPDATE context_artifacts SET status = 'superseded', updated_at = datetime('now') WHERE id = ?",
      ).run(supersedesId);
    }

    db.prepare(
      `INSERT INTO context_artifacts
       (id, project_id, department_id, alignment_session_id, artifact_type, title, content_md,
        author_agent_id, author_human_id, source_task_id, version, status, lifecycle_stage,
        visibility_scope, supersedes_artifact_id, is_archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, 'project', ?, 0)`,
    ).run(
      id,
      project_id,
      req.body.department_id || null,
      req.body.alignment_session_id || null,
      artifact_type,
      title,
      content_md,
      req.body.author_agent_id || null,
      req.body.author_human_id || null,
      req.body.source_task_id || null,
      lifecycleStage,
      supersedesId,
    );

    // Store initial revision
    const revisionId = generateId();
    db.prepare(
      `INSERT INTO context_revisions (id, artifact_id, version, content_md, change_summary_md, created_by_agent_id, created_by_human_id)
       VALUES (?, ?, 1, ?, 'Initial version', ?, ?)`,
    ).run(
      revisionId,
      id,
      content_md,
      req.body.author_agent_id || null,
      req.body.author_human_id || null,
    );

    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(id);
    res.status(201).json({ artifact });
  });

  // GET /api/context-artifacts/:id
  router.get('/api/context-artifacts/:id', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });
    res.json({ artifact });
  });

  // PATCH /api/context-artifacts/:id
  router.patch('/api/context-artifacts/:id', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    const allowed = ['title', 'content_md', 'artifact_type', 'lifecycle_stage', 'visibility_scope'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === 'artifact_type' && !VALID_ARTIFACT_TYPES.includes(req.body[field])) {
          return res.status(400).json({ error: `Invalid artifact_type` });
        }
        if (field === 'lifecycle_stage' && !VALID_LIFECYCLE_STAGES.includes(req.body[field])) {
          return res.status(400).json({ error: `Invalid lifecycle_stage` });
        }
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE context_artifacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    res.json({ artifact: updated });
  });

  // POST /api/context-artifacts/:id/revise
  router.post('/api/context-artifacts/:id/revise', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    if (artifact.is_archived) {
      return res.status(400).json({ error: 'Cannot revise an archived artifact' });
    }
    if (artifact.status === 'superseded') {
      return res.status(400).json({ error: 'Cannot revise a superseded artifact' });
    }

    const { content_md, change_summary_md } = req.body;
    if (!content_md) {
      return res.status(400).json({ error: 'content_md is required' });
    }

    const newVersion = artifact.version + 1;

    // Create revision record
    const revisionId = generateId();
    db.prepare(
      `INSERT INTO context_revisions (id, artifact_id, version, content_md, change_summary_md, created_by_agent_id, created_by_human_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      revisionId,
      artifact.id,
      newVersion,
      content_md,
      change_summary_md || null,
      req.body.created_by_agent_id || null,
      req.body.created_by_human_id || null,
    );

    // Update artifact
    db.prepare(
      "UPDATE context_artifacts SET content_md = ?, version = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(content_md, newVersion, artifact.id);

    const updated = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(artifact.id);
    const revision = db.prepare('SELECT * FROM context_revisions WHERE id = ?').get(revisionId);
    res.json({ artifact: updated, revision });
  });

  // POST /api/context-artifacts/:id/approve
  router.post('/api/context-artifacts/:id/approve', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    if (artifact.status === 'approved') {
      return res.json({ artifact });
    }
    if (artifact.is_archived) {
      return res.status(400).json({ error: 'Cannot approve an archived artifact' });
    }
    if (artifact.status === 'superseded') {
      return res.status(400).json({ error: 'Cannot approve a superseded artifact' });
    }

    db.prepare(
      "UPDATE context_artifacts SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
    ).run(req.params.id);

    const updated = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    res.json({ artifact: updated });
  });

  // POST /api/context-artifacts/:id/reject
  router.post('/api/context-artifacts/:id/reject', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    if (artifact.status === 'rejected') {
      return res.json({ artifact });
    }
    if (artifact.is_archived) {
      return res.status(400).json({ error: 'Cannot reject an archived artifact' });
    }

    db.prepare(
      "UPDATE context_artifacts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?",
    ).run(req.params.id);

    const updated = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    res.json({ artifact: updated });
  });

  // POST /api/context-artifacts/:id/archive
  router.post('/api/context-artifacts/:id/archive', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    if (artifact.is_archived) {
      return res.json({ artifact });
    }

    db.prepare(
      "UPDATE context_artifacts SET is_archived = 1, updated_at = datetime('now') WHERE id = ?",
    ).run(req.params.id);

    const updated = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    res.json({ artifact: updated });
  });

  // GET /api/context-artifacts/:id/revisions
  router.get('/api/context-artifacts/:id/revisions', (req, res) => {
    const artifact = db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    const revisions = db
      .prepare('SELECT * FROM context_revisions WHERE artifact_id = ? ORDER BY version')
      .all(req.params.id);
    res.json({ revisions });
  });

  // POST /api/context-artifacts/:id/link
  router.post('/api/context-artifacts/:id/link', (req, res) => {
    const fromArtifact = db
      .prepare('SELECT * FROM context_artifacts WHERE id = ?')
      .get(req.params.id);
    if (!fromArtifact) return res.status(404).json({ error: 'Source artifact not found' });

    const { to_artifact_id, link_type } = req.body;
    if (!to_artifact_id) return res.status(400).json({ error: 'to_artifact_id is required' });

    const toArtifact = db
      .prepare('SELECT * FROM context_artifacts WHERE id = ?')
      .get(to_artifact_id);
    if (!toArtifact) return res.status(404).json({ error: 'Target artifact not found' });

    const id = generateId();
    db.prepare(
      `INSERT INTO context_links (id, project_id, from_artifact_id, to_artifact_id, link_type)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, fromArtifact.project_id, req.params.id, to_artifact_id, link_type || 'references');

    const link = db.prepare('SELECT * FROM context_links WHERE id = ?').get(id);
    res.status(201).json({ link });
  });

  // GET /api/context-artifacts/:id/links
  router.get('/api/context-artifacts/:id/links', (req, res) => {
    const links = db
      .prepare('SELECT * FROM context_links WHERE from_artifact_id = ? ORDER BY created_at')
      .all(req.params.id);
    res.json({ links });
  });

  // GET /api/projects/:projectId/context-artifacts
  router.get('/api/projects/:projectId/context-artifacts', (req, res) => {
    const { projectId } = req.params;
    let query = 'SELECT * FROM context_artifacts WHERE project_id = ?';
    const params = [projectId];

    if (req.query.include_archived !== 'true') {
      query += ' AND is_archived = 0';
    }

    if (req.query.artifact_type) {
      query += ' AND artifact_type = ?';
      params.push(req.query.artifact_type);
    }

    if (req.query.lifecycle_stage) {
      query += ' AND lifecycle_stage = ?';
      params.push(req.query.lifecycle_stage);
    }

    query += ' ORDER BY created_at DESC';

    const artifacts = db.prepare(query).all(...params);
    res.json({ artifacts });
  });

  // GET /api/context?q=
  router.get('/api/context', (req, res) => {
    const q = req.query.q;
    if (!q) return res.json({ artifacts: [] });

    // Scope search to the agent's project
    const agent = db.prepare('SELECT project_id FROM agents WHERE id = ?').get(req.agent.id);
    if (!agent) return res.json({ artifacts: [] });

    const artifacts = db
      .prepare(
        `SELECT * FROM context_artifacts
       WHERE project_id = ? AND (title LIKE ? OR content_md LIKE ?) AND is_archived = 0
       ORDER BY created_at DESC`,
      )
      .all(agent.project_id, `%${q}%`, `%${q}%`);
    res.json({ artifacts });
  });

  // POST /api/projects/:projectId/validate-source-of-truth
  router.post('/api/projects/:projectId/validate-source-of-truth', (req, res) => {
    const { projectId } = req.params;
    const lifecycleStage = req.body.lifecycle_stage || 'mvp';

    const requiredTypes = ['product_requirements', 'acceptance_criteria'];
    const missing = [];

    for (const type of requiredTypes) {
      const approved = db
        .prepare(
          `SELECT id FROM context_artifacts
         WHERE project_id = ? AND artifact_type = ? AND status = 'approved'
         AND lifecycle_stage = ? AND is_archived = 0`,
        )
        .get(projectId, type, lifecycleStage);

      if (!approved) {
        missing.push(`approved_${type}`);
      }
    }

    res.json({ valid: missing.length === 0, missing });
  });

  return router;
}

module.exports = { createContextArtifactsRouter };
