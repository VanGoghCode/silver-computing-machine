const express = require('express');
const { generateId } = require('../db/helpers');

function createRoleEdgesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // GET /api/projects/:projectId/role-edges
  router.get('/api/projects/:projectId/role-edges', (req, res) => {
    const edges = db
      .prepare(`SELECT * FROM role_edges WHERE project_id = ? ORDER BY created_at`)
      .all(req.params.projectId);
    res.json({ edges });
  });

  // POST /api/projects/:projectId/role-edges
  router.post('/api/projects/:projectId/role-edges', (req, res) => {
    const {
      from_role_instance_id,
      to_role_instance_id,
      edge_type,
      direction,
      can_message,
      can_assign_task,
      can_escalate,
      can_share_context,
      can_request_approval,
      requires_approval,
      policy_json,
    } = req.body;

    if (!from_role_instance_id || !to_role_instance_id) {
      return res
        .status(400)
        .json({ error: 'from_role_instance_id and to_role_instance_id are required' });
    }

    // Validate both role instances belong to this project
    const fromInstance = db
      .prepare(`SELECT * FROM project_role_instances WHERE id = ? AND project_id = ?`)
      .get(from_role_instance_id, req.params.projectId);
    if (!fromInstance) {
      return res.status(400).json({ error: 'from_role_instance_id not found in this project' });
    }

    const toInstance = db
      .prepare(`SELECT * FROM project_role_instances WHERE id = ? AND project_id = ?`)
      .get(to_role_instance_id, req.params.projectId);
    if (!toInstance) {
      return res.status(400).json({ error: 'to_role_instance_id not found in this project' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO role_edges
       (id, project_id, from_role_instance_id, to_role_instance_id, edge_type, direction,
        can_message, can_assign_task, can_escalate, can_share_context, can_request_approval,
        requires_approval, policy_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.params.projectId,
      from_role_instance_id,
      to_role_instance_id,
      edge_type || 'hierarchy',
      direction || 'upstream',
      can_message ? 1 : 0,
      can_assign_task ? 1 : 0,
      can_escalate ? 1 : 0,
      can_share_context ? 1 : 0,
      can_request_approval ? 1 : 0,
      requires_approval ? 1 : 0,
      policy_json || '{}',
    );

    const edge = db.prepare(`SELECT * FROM role_edges WHERE id = ?`).get(id);
    res.status(201).json({ edge });
  });

  // PATCH /api/projects/:projectId/role-edges/:edgeId
  router.patch('/api/projects/:projectId/role-edges/:edgeId', (req, res) => {
    const edge = db
      .prepare(`SELECT * FROM role_edges WHERE id = ? AND project_id = ?`)
      .get(req.params.edgeId, req.params.projectId);
    if (!edge) return res.status(404).json({ error: 'Edge not found' });

    const allowed = [
      'edge_type',
      'direction',
      'can_message',
      'can_assign_task',
      'can_escalate',
      'can_share_context',
      'can_request_approval',
      'requires_approval',
      'policy_json',
    ];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(
          field === 'policy_json'
            ? req.body[field]
            : typeof req.body[field] === 'boolean'
              ? req.body[field]
                ? 1
                : 0
              : req.body[field],
        );
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.edgeId);
      db.prepare(`UPDATE role_edges SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM role_edges WHERE id = ?`).get(req.params.edgeId);
    res.json({ edge: updated });
  });

  // DELETE /api/projects/:projectId/role-edges/:edgeId
  router.delete('/api/projects/:projectId/role-edges/:edgeId', (req, res) => {
    const edge = db
      .prepare(`SELECT * FROM role_edges WHERE id = ? AND project_id = ?`)
      .get(req.params.edgeId, req.params.projectId);
    if (!edge) return res.status(404).json({ error: 'Edge not found' });

    db.prepare(`DELETE FROM role_edges WHERE id = ?`).run(req.params.edgeId);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createRoleEdgesRouter };
