const express = require('express');
const graphifyService = require('../services/graphify');

function createGraphifyRouter(db, config, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/graphify/run
  router.post('/api/projects/:projectId/graphify/run', (req, res) => {
    const { projectId } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    try {
      const run = graphifyService.createGraphifyRun(
        db,
        projectId,
        req.agent ? req.agent.id : null,
        req.body.trigger_reason || 'manual',
        config,
      );
      res.status(201).json({ graphify_run: run });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/projects/:projectId/graphify/runs
  router.get('/api/projects/:projectId/graphify/runs', (req, res) => {
    const { projectId } = req.params;
    const runs = graphifyService.listGraphifyRuns(db, projectId);
    res.json({ graphify_runs: runs });
  });

  // GET /api/graphify/query?q=
  router.get('/api/graphify/query', (req, res) => {
    const results = graphifyService.queryGraphify(db, req.query.q);
    res.json({ results });
  });

  return router;
}

module.exports = { createGraphifyRouter };
