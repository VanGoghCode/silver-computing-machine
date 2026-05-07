const express = require('express');
const { generateId } = require('../db/helpers');

function createClarificationRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/alignment-sessions/:id/questions
  router.post('/api/alignment-sessions/:id/questions', (req, res) => {
    const { target_human_id, question_md, question_type, options_json, priority } = req.body;
    if (!target_human_id || !question_md) {
      return res.status(400).json({ error: 'target_human_id and question_md are required' });
    }

    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Alignment session not found' });
    }

    const id = generateId();
    const roundNumber = req.body.round_number || session.current_round;

    db.prepare(
      `INSERT INTO clarification_questions
       (id, alignment_session_id, asked_by_agent_id, asked_by_role_instance_id,
        target_human_id, question_md, question_type, options_json, priority, status, round_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    ).run(
      id,
      req.params.id,
      req.body.asked_by_agent_id || null,
      req.body.asked_by_role_instance_id || null,
      target_human_id,
      question_md,
      question_type || 'note',
      options_json || null,
      priority || 0,
      roundNumber,
    );

    const question = db.prepare(`SELECT * FROM clarification_questions WHERE id = ?`).get(id);
    res.status(201).json({ question });
  });

  // GET /api/alignment-sessions/:id/questions
  router.get('/api/alignment-sessions/:id/questions', (req, res) => {
    const questions = db
      .prepare(
        `SELECT * FROM clarification_questions WHERE alignment_session_id = ? ORDER BY round_number, created_at`,
      )
      .all(req.params.id);
    res.json({ questions });
  });

  // POST /api/questions/:id/answer
  router.post('/api/questions/:id/answer', (req, res) => {
    const { answered_by_human_id, answer_md, selected_options_json } = req.body;
    if (!answered_by_human_id || !answer_md) {
      return res.status(400).json({ error: 'answered_by_human_id and answer_md are required' });
    }

    const question = db
      .prepare(`SELECT * FROM clarification_questions WHERE id = ?`)
      .get(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO clarification_answers (id, question_id, answered_by_human_id, answer_md, selected_options_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, req.params.id, answered_by_human_id, answer_md, selected_options_json || null);

    // Mark question as answered
    db.prepare(
      `UPDATE clarification_questions SET status = 'answered', answered_at = datetime('now') WHERE id = ?`,
    ).run(req.params.id);

    const answer = db.prepare(`SELECT * FROM clarification_answers WHERE id = ?`).get(id);
    res.status(201).json({ answer });
  });

  // GET /api/alignment-sessions/:id/answers
  router.get('/api/alignment-sessions/:id/answers', (req, res) => {
    const answers = db
      .prepare(
        `SELECT ca.* FROM clarification_answers ca
         JOIN clarification_questions cq ON cq.id = ca.question_id
         WHERE cq.alignment_session_id = ?
         ORDER BY ca.created_at`,
      )
      .all(req.params.id);
    res.json({ answers });
  });

  return router;
}

module.exports = { createClarificationRouter };
