const express = require('express');

function createHealthRouter(config) {
  const router = express.Router();

  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', workspace: config.workspaceDir, uptime: process.uptime() });
  });

  return router;
}

module.exports = { createHealthRouter };
