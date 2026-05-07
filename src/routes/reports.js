const express = require('express');
const reportService = require('../services/reports');

function createReportsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/reports/daily
  router.post('/api/projects/:projectId/reports/daily', (req, res) => {
    const { projectId } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    try {
      const report = reportService.createDailyReport(
        db,
        projectId,
        req.agent ? req.agent.id : null,
      );
      res.status(201).json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/projects/:projectId/reports
  router.get('/api/projects/:projectId/reports', (req, res) => {
    const { projectId } = req.params;
    const reports = reportService.listReports(db, projectId);
    res.json({ reports });
  });

  return router;
}

module.exports = { createReportsRouter };
