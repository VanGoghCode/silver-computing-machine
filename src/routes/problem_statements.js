const express = require('express');
const { generateId } = require('../db/helpers');

function createProblemStatementsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/problem-statements
  router.post('/api/projects/:projectId/problem-statements', (req, res) => {
    const { human_id, title, content_md } = req.body;
    if (!human_id || !title || !content_md) {
      return res.status(400).json({ error: 'human_id, title, and content_md are required' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO problem_statements (id, project_id, human_id, title, content_md, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, req.agent.project_id, human_id, title, content_md, 'draft');

    const ps = db.prepare(`SELECT * FROM problem_statements WHERE id = ?`).get(id);
    res.status(201).json({ problem_statement: ps });
  });

  // GET /api/projects/:projectId/problem-statements
  router.get('/api/projects/:projectId/problem-statements', (req, res) => {
    const statements = db
      .prepare(`SELECT * FROM problem_statements WHERE project_id = ? ORDER BY created_at DESC`)
      .all(req.agent.project_id);
    res.json({ problem_statements: statements });
  });

  // GET /api/problem-statements/:id
  router.get('/api/problem-statements/:id', (req, res) => {
    const ps = db
      .prepare(`SELECT * FROM problem_statements WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!ps) return res.status(404).json({ error: 'Problem statement not found' });
    res.json({ problem_statement: ps });
  });

  // PATCH /api/problem-statements/:id
  router.patch('/api/problem-statements/:id', (req, res) => {
    const ps = db
      .prepare(`SELECT * FROM problem_statements WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!ps) return res.status(404).json({ error: 'Problem statement not found' });

    const allowed = ['title', 'content_md', 'status'];
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
      values.push(req.params.id, req.agent.project_id);
      db.prepare(
        `UPDATE problem_statements SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
      ).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM problem_statements WHERE id = ?`).get(req.params.id);
    res.json({ problem_statement: updated });
  });

  return router;
}

module.exports = { createProblemStatementsRouter };
