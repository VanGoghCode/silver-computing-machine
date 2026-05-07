const express = require('express');

function createTasksRouter() {
  const router = express.Router();

  router.get('/api/my-tasks', (_req, res) => {
    // Stub: return empty tasks list
    res.json({ tasks: [] });
  });

  return router;
}

module.exports = { createTasksRouter };
