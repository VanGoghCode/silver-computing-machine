const express = require('express');
const prService = require('../services/local_prs');

function createLocalPrsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/local-prs
  router.post('/api/local-prs', (req, res) => {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
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
    const prs = prService.listLocalPrs(db, req.agent.project_id);
    res.json({ local_prs: prs });
  });

  // GET /api/local-prs/:id
  router.get('/api/local-prs/:id', (req, res) => {
    const pr = prService.getLocalPr(db, req.params.id, req.agent.project_id);
    if (!pr) return res.status(404).json({ error: 'PR not found' });
    res.json({ local_pr: pr });
  });

  // PATCH /api/local-prs/:id
  router.patch('/api/local-prs/:id', (req, res) => {
    try {
      const pr = prService.updateLocalPr(db, req.params.id, req.body, req.agent);
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
