const express = require('express');
const { generateId } = require('../db/helpers');

function createHumanApprovalsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/approvals
  router.post('/api/projects/:projectId/approvals', (req, res) => {
    const { alignment_session_id, artifact_id, human_id, approval_type } = req.body;
    if (!human_id || !approval_type) {
      return res.status(400).json({ error: 'human_id and approval_type are required' });
    }

    const projectId = req.agent.project_id;
    if (alignment_session_id) {
      const session = db
        .prepare('SELECT id FROM alignment_sessions WHERE id = ? AND project_id = ?')
        .get(alignment_session_id, projectId);
      if (!session)
        return res.status(400).json({ error: 'Alignment session not found in this project' });
    }
    if (artifact_id) {
      const artifact = db
        .prepare('SELECT id FROM context_artifacts WHERE id = ? AND project_id = ?')
        .get(artifact_id, projectId);
      if (!artifact) return res.status(400).json({ error: 'Artifact not found in this project' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO human_approvals
       (id, project_id, alignment_session_id, artifact_id, human_id, approval_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    ).run(
      id,
      projectId,
      alignment_session_id || null,
      artifact_id || null,
      human_id,
      approval_type,
    );

    const approval = db.prepare(`SELECT * FROM human_approvals WHERE id = ?`).get(id);
    res.status(201).json({ approval });
  });

  // GET /api/projects/:projectId/alignment-status
  router.get('/api/projects/:projectId/alignment-status', (req, res) => {
    const projectId = req.agent.project_id;
    // Check if project has approved alignment sessions
    const approvedSession = db
      .prepare(`SELECT * FROM alignment_sessions WHERE project_id = ? AND status = 'approved'`)
      .get(projectId);

    const alignedPs = db
      .prepare(`SELECT * FROM problem_statements WHERE project_id = ? AND status = 'aligned'`)
      .all(projectId);

    const canCreateTasks = !!(approvedSession || alignedPs.length > 0);

    res.json({
      can_create_engineering_tasks: canCreateTasks,
      approved_sessions: approvedSession ? 1 : 0,
      aligned_problem_statements: alignedPs.length,
    });
  });

  // GET /api/projects/:projectId/approvals
  router.get('/api/projects/:projectId/approvals', (req, res) => {
    const approvals = db
      .prepare('SELECT * FROM human_approvals WHERE project_id = ? ORDER BY created_at DESC')
      .all(req.agent.project_id);
    res.json({ approvals });
  });

  // PATCH /api/approvals/:id
  router.patch('/api/approvals/:id', (req, res) => {
    const approval = db
      .prepare(`SELECT * FROM human_approvals WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!approval) return res.status(404).json({ error: 'Approval not found' });

    const allowed = ['status', 'notes_md'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE human_approvals SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM human_approvals WHERE id = ?`).get(req.params.id);

    // If approved and linked to a session, update session status
    if (updated.status === 'approved' && updated.alignment_session_id) {
      // Check if all pending approvals for this session are now approved
      const pendingCount = db
        .prepare(
          `SELECT COUNT(*) as c FROM human_approvals WHERE alignment_session_id = ? AND status = 'pending'`,
        )
        .get(updated.alignment_session_id).c;

      if (pendingCount === 0) {
        db.prepare(
          `UPDATE alignment_sessions SET status = 'approved', updated_at = datetime('now') WHERE id = ?`,
        ).run(updated.alignment_session_id);

        // Update problem statement to aligned
        const session = db
          .prepare(`SELECT * FROM alignment_sessions WHERE id = ?`)
          .get(updated.alignment_session_id);
        if (session) {
          db.prepare(
            `UPDATE problem_statements SET status = 'aligned', updated_at = datetime('now') WHERE id = ?`,
          ).run(session.problem_statement_id);
        }
      }
    }

    res.json({ approval: updated });
  });

  return router;
}

module.exports = { createHumanApprovalsRouter };
