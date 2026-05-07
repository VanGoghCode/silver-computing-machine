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
    // Only allow agents to preview their own prompt
    if (req.params.agentId !== req.agent.id) {
      return res.status(403).json({ error: 'Can only preview your own prompt' });
    }

    try {
      const options = {
        lifecycle_stage: req.query.lifecycle_stage || 'mvp',
        include_draft: req.query.include_draft === 'true',
      };
      const bundle = assemblePrompt(db, req.agent.id, options);
      res.json({ bundle });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAgentsRouter };
