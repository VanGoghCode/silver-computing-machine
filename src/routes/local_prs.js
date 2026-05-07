const express = require('express');
const prService = require('../services/local_prs');

function createLocalPrsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/local-prs
  router.post('/api/local-prs', (req, res) => {
    const { project_id, title } = req.body;
    if (!project_id || !title) {
      return res.status(400).json({ error: 'project_id and title are required' });
    }
    try {
      const pr = prService.createLocalPr(db, req.body, req.agent.id);
      res.status(201).json({ local_pr: pr });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/local-prs
  router.get('/api/local-prs', (req, res) => {
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'project_id query parameter required' });
    }
    const prs = prService.listLocalPrs(db, projectId);
    res.json({ local_prs: prs });
  });

  // GET /api/local-prs/:id
  router.get('/api/local-prs/:id', (req, res) => {
    const pr = prService.getLocalPr(db, req.params.id);
    if (!pr) return res.status(404).json({ error: 'PR not found' });
    res.json({ local_pr: pr });
  });

  // PATCH /api/local-prs/:id
  router.patch('/api/local-prs/:id', (req, res) => {
    try {
      const pr = prService.updateLocalPr(db, req.params.id, req.body);
      res.json({ local_pr: pr });
    } catch (err) {
      if (err.message === 'PR not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createLocalPrsRouter };
