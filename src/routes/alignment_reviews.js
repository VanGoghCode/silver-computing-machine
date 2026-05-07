const express = require('express');
const { generateId } = require('../db/helpers');

function createAlignmentReviewsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/alignment-sessions/:id/review
  router.post('/api/alignment-sessions/:id/review', (req, res) => {
    const { review_md, missing_info_md, next_questions_needed } = req.body;
    if (!review_md) {
      return res.status(400).json({ error: 'review_md is required' });
    }

    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Alignment session not found' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO alignment_reviews
       (id, alignment_session_id, reviewed_by_agent_id, review_md, missing_info_md, next_questions_needed)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.params.id,
      req.body.reviewed_by_agent_id || null,
      review_md,
      missing_info_md || null,
      next_questions_needed !== undefined ? (next_questions_needed ? 1 : 0) : 0,
    );

    // If no more questions needed, mark session as ready_for_docs
    if (next_questions_needed === 0) {
      db.prepare(
        `UPDATE alignment_sessions SET status = 'ready_for_docs', updated_at = datetime('now') WHERE id = ?`,
      ).run(req.params.id);
    }

    const review = db.prepare(`SELECT * FROM alignment_reviews WHERE id = ?`).get(id);
    res.status(201).json({ review });
  });

  return router;
}

module.exports = { createAlignmentReviewsRouter };
