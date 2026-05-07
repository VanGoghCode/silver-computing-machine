const express = require('express');
const { updateHeartbeat } = require('../services/agents');
const { assemblePrompt } = require('../services/prompt_assembler');

function createAgentsRouter(db) {
  const router = express.Router();

  router.get('/api/agents/me', (req, res) => {
    const agent = req.agent;
    res.json({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      worker_status: agent.worker_status,
      project: {
        id: agent.project_id,
        slug: agent.project_slug,
        root_path: agent.project_root_path,
      },
      department: {
        id: agent.department_id,
        key: agent.department_key,
      },
      role: {
        key: agent.role_key,
        display_name: agent.role_display_name,
      },
    });
  });

  router.post('/api/agents/heartbeat', (req, res) => {
    const { status, current_task_id, payload } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    updateHeartbeat(
      db,
      req.agent.id,
      status,
      current_task_id,
      payload ? JSON.stringify(payload) : '{}',
    );
    res.json({ ok: true });
  });

  router.get('/api/agents/:agentId/prompt-preview', (req, res) => {
    const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    try {
      const bundle = assemblePrompt(db, agent.id, agent.role_instance_id);
      res.json({ bundle });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAgentsRouter };
