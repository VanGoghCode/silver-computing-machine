const express = require('express');
const { createProject } = require('../services/projects');
const { MockRuntimeManager } = require('../services/runtime_manager');

function createProjectsRouter(db, config, auth) {
  const router = express.Router();

  // Use runtime manager from config, or create a mock
  const runtimeManager = config.runtimeManager || new MockRuntimeManager();

  router.post('/api/projects', auth, (req, res) => {
    try {
      const result = createProject(db, config, req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err.code === 'DUPLICATE_SLUG') {
        return res.status(409).json({ error: err.message });
      }
      if (err.message.includes('required') || err.message.includes('Invalid')) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/projects/:id/start-runtime', auth, async (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    try {
      // Create runtime if not exists
      const status = await runtimeManager.getProjectRuntimeStatus(project.id);
      if (!status) {
        await runtimeManager.createProjectRuntime(project.id);
      }
      const result = await runtimeManager.startProjectRuntime(project.id);
      db.prepare('UPDATE projects SET runtime_status = ?, updated_at = ? WHERE id = ?').run(
        'running',
        new Date().toISOString(),
        project.id,
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/projects/:id/stop-runtime', auth, async (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    try {
      const result = await runtimeManager.stopProjectRuntime(project.id);
      db.prepare('UPDATE projects SET runtime_status = ?, updated_at = ? WHERE id = ?').run(
        'stopped',
        new Date().toISOString(),
        project.id,
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/projects/:id/spawn-workers', auth, async (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const runtimeStatus = await runtimeManager.getProjectRuntimeStatus(project.id);
    if (!runtimeStatus || runtimeStatus.status !== 'running') {
      return res.status(400).json({ error: 'Project runtime is not running' });
    }

    const agents = db
      .prepare('SELECT * FROM agents WHERE project_id = ? AND status = ?')
      .all(project.id, 'active');

    let spawned = 0;
    for (const agent of agents) {
      try {
        await runtimeManager.spawnWorker(project.id, agent.id);
        spawned++;
      } catch {
        // Skip agents that fail to spawn
      }
    }

    res.json({ spawned });
  });

  return router;
}

module.exports = { createProjectsRouter };
