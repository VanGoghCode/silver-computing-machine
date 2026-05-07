const express = require('express');
const { generateId } = require('../db/helpers');

function createRoleNodesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // GET /api/projects/:projectId/role-nodes
  router.get('/api/projects/:projectId/role-nodes', (req, res) => {
    const nodes = db
      .prepare(
        `SELECT pri.*, rt.key as role_key, rt.display_name as role_display_name
         FROM project_role_instances pri
         JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE pri.project_id = ? AND pri.is_active = 1
         ORDER BY pri.display_name`,
      )
      .all(req.agent.project_id);
    res.json({ nodes });
  });

  // POST /api/projects/:projectId/role-nodes
  router.post('/api/projects/:projectId/role-nodes', (req, res) => {
    const {
      department_id,
      role_template_id,
      display_name,
      canvas_x,
      canvas_y,
      model_profile_id,
      permission_profile_id,
    } = req.body;

    if (!department_id || !role_template_id || !display_name) {
      return res
        .status(400)
        .json({ error: 'department_id, role_template_id, and display_name are required' });
    }

    // Validate department belongs to this project
    const dept = db
      .prepare(`SELECT * FROM departments WHERE id = ? AND project_id = ?`)
      .get(department_id, req.agent.project_id);
    if (!dept) {
      return res.status(400).json({ error: 'Department not found in this project' });
    }

    // Validate role template exists
    const template = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(role_template_id);
    if (!template) {
      return res.status(400).json({ error: 'Role template not found' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO project_role_instances
       (id, project_id, department_id, role_template_id, display_name, canvas_x, canvas_y, model_profile_id, permission_profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.agent.project_id,
      department_id,
      role_template_id,
      display_name,
      canvas_x || 0,
      canvas_y || 0,
      model_profile_id || null,
      permission_profile_id || null,
    );

    const node = db
      .prepare(
        `SELECT pri.*, rt.key as role_key, rt.display_name as role_display_name
         FROM project_role_instances pri
         JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE pri.id = ?`,
      )
      .get(id);
    res.status(201).json({ node });
  });

  // PATCH /api/projects/:projectId/role-nodes/:nodeId
  router.patch('/api/projects/:projectId/role-nodes/:nodeId', (req, res) => {
    const node = db
      .prepare(`SELECT * FROM project_role_instances WHERE id = ? AND project_id = ?`)
      .get(req.params.nodeId, req.agent.project_id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const allowed = [
      'department_id',
      'role_template_id',
      'display_name',
      'canvas_x',
      'canvas_y',
      'model_profile_id',
      'permission_profile_id',
      'is_active',
    ];
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
      values.push(req.params.nodeId);
      db.prepare(`UPDATE project_role_instances SET ${updates.join(', ')} WHERE id = ?`).run(
        ...values,
      );
    }

    const updated = db
      .prepare(
        `SELECT pri.*, rt.key as role_key, rt.display_name as role_display_name
         FROM project_role_instances pri
         JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE pri.id = ?`,
      )
      .get(req.params.nodeId);
    res.json({ node: updated });
  });

  // DELETE /api/projects/:projectId/role-nodes/:nodeId (soft delete)
  router.delete('/api/projects/:projectId/role-nodes/:nodeId', (req, res) => {
    const node = db
      .prepare(`SELECT * FROM project_role_instances WHERE id = ? AND project_id = ?`)
      .get(req.params.nodeId, req.agent.project_id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    db.prepare(
      `UPDATE project_role_instances SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
    ).run(req.params.nodeId);

    res.json({ ok: true });
  });

  return router;
}

module.exports = { createRoleNodesRouter };
