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

    const session = db
      .prepare(`SELECT * FROM alignment_sessions WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
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
      req.agent.id,
      req.body.department_id || req.agent.department_id || null,
      title,
      content_md,
      req.body.source_refs_json || null,
      req.body.confidence || null,
    );

    const note = db.prepare(`SELECT * FROM research_notes WHERE id = ?`).get(id);
    db.prepare(
      `INSERT INTO research_note_revisions
       (id, research_note_id, version, content_md, change_summary_md, created_by_agent_id)
       VALUES (?, ?, 1, ?, 'Initial version', ?)`,
    ).run(generateId(), id, content_md, req.agent.id);
    res.status(201).json({ research_note: note });
  });

  // GET /api/alignment-sessions/:id/research-notes
  router.get('/api/alignment-sessions/:id/research-notes', (req, res) => {
    const notes = db
      .prepare(
        `SELECT rn.*
         FROM research_notes rn
         JOIN alignment_sessions s ON s.id = rn.alignment_session_id
         WHERE rn.alignment_session_id = ? AND s.project_id = ?
         ORDER BY rn.created_at`,
      )
      .all(req.params.id, req.agent.project_id);
    res.json({ research_notes: notes });
  });

  // PATCH /api/research-notes/:id
  router.patch('/api/research-notes/:id', (req, res) => {
    const note = db
      .prepare(`SELECT * FROM research_notes WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!note) return res.status(404).json({ error: 'Research note not found' });

    if (req.body.content_md !== undefined) {
      const newVersion = note.version + 1;
      db.prepare(
        `INSERT INTO research_note_revisions
         (id, research_note_id, version, content_md, change_summary_md, created_by_agent_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        generateId(),
        note.id,
        newVersion,
        req.body.content_md,
        req.body.change_summary_md || 'Updated research note',
        req.agent.id,
      );
      db.prepare(
        "UPDATE research_notes SET content_md = ?, version = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(req.body.content_md, newVersion, note.id);
    }

    const allowed = ['title', 'source_refs_json', 'confidence'];
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
