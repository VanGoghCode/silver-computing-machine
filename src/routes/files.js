const express = require('express');
const fs = require('fs');
const path = require('path');
const { safePath } = require('../services/path_safety');

function createFilesRouter(config) {
  const router = express.Router();

  router.get('/api/files', (req, res) => {
    const dir = safePath(config.workspaceDir, req.query.dir || '');
    if (!dir) return res.status(403).json({ error: 'Path escapes workspace' });
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
      }));
      res.json({ path: dir, entries });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get('/api/files/:filePath(*)', (req, res) => {
    const fullPath = safePath(config.workspaceDir, req.params.filePath);
    if (!fullPath) return res.status(403).json({ error: 'Path escapes workspace' });
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.json({ path: fullPath, content });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.put('/api/files/:filePath(*)', (req, res) => {
    const fullPath = safePath(config.workspaceDir, req.params.filePath);
    if (!fullPath) return res.status(403).json({ error: 'Path escapes workspace' });
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) is required' });
    }
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      res.json({ path: fullPath, written: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createFilesRouter };
