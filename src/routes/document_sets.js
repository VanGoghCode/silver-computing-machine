const express = require('express');
const { generateId } = require('../db/helpers');

function createDocumentSetsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/document-sets
  router.post('/api/projects/:projectId/document-sets', (req, res) => {
    const { projectId } = req.params;
    const { name, stage, alignment_session_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO document_sets (id, project_id, alignment_session_id, name, stage, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`,
    ).run(id, projectId, alignment_session_id || null, name, stage || 'discovery');

    const documentSet = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(id);
    res.status(201).json({ document_set: documentSet });
  });

  // GET /api/projects/:projectId/document-sets
  router.get('/api/projects/:projectId/document-sets', (req, res) => {
    const documentSets = db
      .prepare('SELECT * FROM document_sets WHERE project_id = ? ORDER BY created_at')
      .all(req.params.projectId);
    res.json({ document_sets: documentSets });
  });

  // GET /api/document-sets/:id
  router.get('/api/document-sets/:id', (req, res) => {
    const documentSet = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    if (!documentSet) return res.status(404).json({ error: 'Document set not found' });

    const items = db
      .prepare('SELECT * FROM document_set_items WHERE document_set_id = ? ORDER BY created_at')
      .all(req.params.id);

    res.json({ document_set: documentSet, items });
  });

  // POST /api/document-sets/:id/items
  router.post('/api/document-sets/:id/items', (req, res) => {
    const documentSet = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    if (!documentSet) return res.status(404).json({ error: 'Document set not found' });

    const { artifact_ids } = req.body;
    if (!artifact_ids || !Array.isArray(artifact_ids) || artifact_ids.length === 0) {
      return res.status(400).json({ error: 'artifact_ids array is required' });
    }

    // Validate all artifacts exist and belong to the same project
    for (const artifactId of artifact_ids) {
      const artifact = db
        .prepare('SELECT project_id FROM context_artifacts WHERE id = ?')
        .get(artifactId);
      if (!artifact) {
        return res.status(400).json({ error: `Artifact ${artifactId} not found` });
      }
      if (artifact.project_id !== documentSet.project_id) {
        return res
          .status(400)
          .json({ error: `Artifact ${artifactId} belongs to a different project` });
      }
    }

    const items = [];
    for (const artifactId of artifact_ids) {
      const id = generateId();
      db.prepare(
        'INSERT INTO document_set_items (id, document_set_id, artifact_id, required) VALUES (?, ?, ?, 1)',
      ).run(id, req.params.id, artifactId);
      items.push(db.prepare('SELECT * FROM document_set_items WHERE id = ?').get(id));
    }

    res.status(201).json({ items });
  });

  // PATCH /api/document-sets/:id
  router.patch('/api/document-sets/:id', (req, res) => {
    const documentSet = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    if (!documentSet) return res.status(404).json({ error: 'Document set not found' });

    const allowed = ['name', 'stage', 'status'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE document_sets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    res.json({ document_set: updated });
  });

  // POST /api/document-sets/:id/approve
  router.post('/api/document-sets/:id/approve', (req, res) => {
    const documentSet = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    if (!documentSet) return res.status(404).json({ error: 'Document set not found' });

    db.prepare(
      "UPDATE document_sets SET status = 'approved', updated_at = datetime('now') WHERE id = ?",
    ).run(req.params.id);

    const updated = db.prepare('SELECT * FROM document_sets WHERE id = ?').get(req.params.id);
    res.json({ document_set: updated });
  });

  return router;
}

module.exports = { createDocumentSetsRouter };
