const express = require('express');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';

app.use(express.json());

// ---------- Sandbox: prevent path traversal outside /workspace ----------

function safePath(...segments) {
  const resolved = path.resolve(WORKSPACE_DIR, ...segments);
  if (!resolved.startsWith(WORKSPACE_DIR + path.sep) && resolved !== WORKSPACE_DIR) {
    return null; // attempted escape
  }
  return resolved;
}

// ---------- Health ----------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', workspace: WORKSPACE_DIR, uptime: process.uptime() });
});

// ---------- Workspace File Operations ----------

// List files in workspace
app.get('/api/files', (req, res) => {
  const dir = safePath(req.query.dir || '');
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

// Read a file from workspace
app.get('/api/files/:filePath(*)', (req, res) => {
  const fullPath = safePath(req.params.filePath);
  if (!fullPath) return res.status(403).json({ error: 'Path escapes workspace' });
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ path: fullPath, content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Write a file to workspace
app.put('/api/files/:filePath(*)', (req, res) => {
  const fullPath = safePath(req.params.filePath);
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

// ---------- Start ----------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Humai Workspace running at http://localhost:${PORT}`);
  console.log(`Workspace dir: ${WORKSPACE_DIR}`);
  console.log(`Sandbox: file access restricted to ${WORKSPACE_DIR}`);
});
