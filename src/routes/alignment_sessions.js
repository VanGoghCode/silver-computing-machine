const express = require('express');
const { generateId } = require('../db/helpers');

const LEADERSHIP_ROLES = ['ceo', 'cto', 'product_manager'];

function createAlignmentSessionsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/alignment-sessions
  router.post('/api/projects/:projectId/alignment-sessions', (req, res) => {
    const { problem_statement_id, title } = req.body;
    if (!problem_statement_id || !title) {
      return res.status(400).json({ error: 'problem_statement_id and title are required' });
    }

    const ps = db
      .prepare(`SELECT * FROM problem_statements WHERE id = ? AND project_id = ?`)
      .get(problem_statement_id, req.agent.project_id);
    if (!ps) {
      return res.status(400).json({ error: 'Problem statement not found in this project' });
    }

    const sessionId = generateId();

    // Create session
    db.prepare(
      `INSERT INTO alignment_sessions (id, project_id, problem_statement_id, title, status, current_round)
       VALUES (?, ?, ?, ?, 'active', 1)`,
    ).run(sessionId, req.agent.project_id, problem_statement_id, title);

    // Update problem statement status
    db.prepare(
      `UPDATE problem_statements SET status = 'in_alignment', updated_at = datetime('now') WHERE id = ?`,
    ).run(problem_statement_id);

    // Auto-select CEO/CTO/PM participants from role instances in this project
    const participants = [];
    const leadershipNodes = db
      .prepare(
        `SELECT pri.id as role_instance_id, pri.department_id, rt.key as role_key
         FROM project_role_instances pri
         JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE pri.project_id = ? AND pri.is_active = 1 AND rt.key IN (${LEADERSHIP_ROLES.map(() => '?').join(',')})
         ORDER BY rt.key`,
      )
      .all(req.agent.project_id, ...LEADERSHIP_ROLES);

    for (const node of leadershipNodes) {
      const participantId = generateId();
      db.prepare(
        `INSERT INTO alignment_participants (id, alignment_session_id, participant_type, role_instance_id, department_id)
         VALUES (?, ?, 'ai_role', ?, ?)`,
      ).run(participantId, sessionId, node.role_instance_id, node.department_id);
      participants.push({
        id: participantId,
        role_key: node.role_key,
        role_instance_id: node.role_instance_id,
        department_id: node.department_id,
      });
    }

    // Add human participant
    const humanParticipantId = generateId();
    db.prepare(
      `INSERT INTO alignment_participants (id, alignment_session_id, participant_type, human_id)
       VALUES (?, ?, 'human', ?)`,
    ).run(humanParticipantId, sessionId, ps.human_id);
    participants.push({
      id: humanParticipantId,
      participant_type: 'human',
      human_id: ps.human_id,
    });

    const session = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(sessionId);
    res.status(201).json({ session, participants });
  });

  // GET /api/projects/:projectId/alignment-sessions
  router.get('/api/projects/:projectId/alignment-sessions', (req, res) => {
    const sessions = db
      .prepare(`SELECT * FROM alignment_sessions WHERE project_id = ? ORDER BY created_at DESC`)
      .all(req.agent.project_id);
    res.json({ sessions });
  });

  // GET /api/alignment-sessions/:id
  router.get('/api/alignment-sessions/:id', (req, res) => {
    const session = db
      .prepare(`SELECT * FROM alignment_sessions WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!session) return res.status(404).json({ error: 'Alignment session not found' });

    const participants = db
      .prepare(
        `SELECT ap.*, rt.key as role_key, rt.display_name as role_display_name
         FROM alignment_participants ap
         LEFT JOIN project_role_instances pri ON pri.id = ap.role_instance_id
         LEFT JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE ap.alignment_session_id = ?`,
      )
      .all(req.params.id);

    res.json({ session, participants });
  });

  // PATCH /api/alignment-sessions/:id
  router.patch('/api/alignment-sessions/:id', (req, res) => {
    const session = db
      .prepare(`SELECT * FROM alignment_sessions WHERE id = ? AND project_id = ?`)
      .get(req.params.id, req.agent.project_id);
    if (!session) return res.status(404).json({ error: 'Alignment session not found' });

    const allowed = ['title', 'status', 'current_round', 'alignment_score'];
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
      if (req.body.status === 'closed') {
        updates.push("closed_at = datetime('now')");
      }
      values.push(req.params.id);
      db.prepare(`UPDATE alignment_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM alignment_sessions WHERE id = ?`).get(req.params.id);
    res.json({ session: updated });
  });

  return router;
}

module.exports = { createAlignmentSessionsRouter };
