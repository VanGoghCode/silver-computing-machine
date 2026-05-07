const express = require('express');
const { updateHeartbeat } = require('../services/agents');
const {
  createAgent,
  rotateAgentToken,
  revokeAgent,
  listAgents,
  getAgent,
} = require('../services/agent_tokens');
const { assemblePrompt } = require('../services/prompt_assembler');
const { VALID_WORKER_STATUSES } = require('../services/heartbeat');

function createAgentsRouter(db) {
  const router = express.Router();

  // --- Admin APIs (auth required) ---

  router.post('/api/agents', (req, res) => {
    const { department_id, role_instance_id, name } = req.body;
    if (!department_id || !role_instance_id || !name) {
      return res.status(400).json({
        error: 'department_id, role_instance_id, and name are required',
      });
    }

    try {
      const result = createAgent(db, {
        project_id: req.agent.project_id,
        department_id,
        role_instance_id,
        name,
      });
      res.status(201).json({ agent: result.agent, token: result.token });
    } catch (err) {
      if (err.code === 'INVALID_REF') {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/agents', (req, res) => {
    const agents = listAgents(db, req.agent.project_id);
    res.json({ agents });
  });

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

  router.get('/api/agents/:id', (req, res) => {
    // Route conflict: "me" and prompt-preview are handled above or via specific paths
    const agent = getAgent(db, req.params.id);
    if (!agent || agent.project_id !== req.agent.project_id) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  });

  router.post('/api/agents/:id/token/rotate', (req, res) => {
    const agent = getAgent(db, req.params.id);
    if (!agent || agent.project_id !== req.agent.project_id) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    try {
      const newToken = rotateAgentToken(db, req.params.id);
      if (!newToken) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      res.json({ token: newToken });
    } catch (err) {
      if (err.code === 'AGENT_REVOKED') {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/agents/:id/revoke', (req, res) => {
    const agent = getAgent(db, req.params.id);
    if (!agent || agent.project_id !== req.agent.project_id) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const result = revokeAgent(db, req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ ok: true });
  });

  // --- Worker APIs ---

  router.post('/api/agents/heartbeat', (req, res) => {
    const { status, current_task_id, payload } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!VALID_WORKER_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ error: `Invalid status. Must be one of: ${VALID_WORKER_STATUSES.join(', ')}` });
    }
    if (current_task_id) {
      const task = db
        .prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?')
        .get(current_task_id, req.agent.project_id);
      if (!task) {
        return res.status(403).json({ error: 'current_task_id is outside this project' });
      }
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
