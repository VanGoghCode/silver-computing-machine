const express = require('express');
const { generateId } = require('../db/helpers');

function createResearchNotesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/alignment-sessions/:id/research-notes
  router.post('/api/alignment-sessions/:id/research-notes', (req, res) => {
    const { title, content_md } = req.body;
    if (!title || !content_md) {
      return res.status(400).json({ error: 'title and content_md are required' });
    }

    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Alignment session not found' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO research_notes
       (id, project_id, alignment_session_id, created_by_agent_id, department_id,
        title, content_md, source_refs_json, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      session.project_id,
      req.params.id,
      req.body.created_by_agent_id || null,
      req.body.department_id || null,
      title,
      content_md,
      req.body.source_refs_json || null,
      req.body.confidence || null,
    );

    const note = db.prepare(`SELECT * FROM research_notes WHERE id = ?`).get(id);
    res.status(201).json({ research_note: note });
  });

  // GET /api/alignment-sessions/:id/research-notes
  router.get('/api/alignment-sessions/:id/research-notes', (req, res) => {
    const notes = db
      .prepare(`SELECT * FROM research_notes WHERE alignment_session_id = ? ORDER BY created_at`)
      .all(req.params.id);
    res.json({ research_notes: notes });
  });

  // PATCH /api/research-notes/:id
  router.patch('/api/research-notes/:id', (req, res) => {
    const note = db.prepare(`SELECT * FROM research_notes WHERE id = ?`).get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Research note not found' });

    const allowed = ['title', 'content_md', 'source_refs_json', 'confidence'];
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
      db.prepare(`UPDATE research_notes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM research_notes WHERE id = ?`).get(req.params.id);
    res.json({ research_note: updated });
  });

  return router;
}

module.exports = { createResearchNotesRouter };
