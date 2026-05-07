const express = require('express');
const auditService = require('../services/audits');

function createAuditsRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/projects/:projectId/audits/run
  router.post('/api/projects/:projectId/audits/run', (req, res) => {
    const { projectId } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    try {
      const run = auditService.createAuditRun(
        db,
        projectId,
        req.agent ? req.agent.id : null,
        req.body.department_id || null,
      );
      res.status(201).json({ audit_run: run });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/projects/:projectId/audits
  router.get('/api/projects/:projectId/audits', (req, res) => {
    const { projectId } = req.params;
    const runs = auditService.listAuditRuns(db, projectId);
    res.json({ audit_runs: runs });
  });

  return router;
}

module.exports = { createAuditsRouter };
