const express = require('express');
const path = require('path');
const { generateId } = require('../db/helpers');
const { importRoleLibrary } = require('../services/role_library_import');

function createRoleTemplatesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // GET /api/role-templates
  router.get('/api/role-templates', (req, res) => {
    const templates = db.prepare(`SELECT * FROM role_templates ORDER BY key`).all();
    res.json({ templates });
  });

  // GET /api/role-templates/:id
  router.get('/api/role-templates/:id', (req, res) => {
    const template = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  });

  // GET /api/role-templates/:id/prompt-files
  router.get('/api/role-templates/:id/prompt-files', (req, res) => {
    const template = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const files = db
      .prepare(
        `SELECT * FROM role_prompt_files WHERE role_template_id = ? AND is_active = 1 ORDER BY section_key`,
      )
      .all(req.params.id);
    res.json({ files });
  });

  // POST /api/role-templates
  router.post('/api/role-templates', (req, res) => {
    const { key, display_name, description } = req.body;
    if (!key || !display_name) {
      return res.status(400).json({ error: 'key and display_name are required' });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO role_templates (id, key, display_name, description) VALUES (?, ?, ?, ?)`,
    ).run(id, key, display_name, description || null);

    const template = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(id);
    res.status(201).json({ template });
  });

  // PATCH /api/role-templates/:id
  router.patch('/api/role-templates/:id', (req, res) => {
    const template = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const { display_name, description } = req.body;
    const updates = [];
    const values = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE role_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`SELECT * FROM role_templates WHERE id = ?`).get(req.params.id);
    res.json({ template: updated });
  });

  // POST /api/role-templates/import-from-files
  router.post('/api/role-templates/import-from-files', (req, res) => {
    const libraryPath = req.body.path;
    if (!libraryPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    // Validate path is within allowed roots (project dir or relative to cwd)
    const resolved = path.resolve(libraryPath);
    const allowedRoots = [path.resolve('.'), path.resolve('./role-library')];
    const isAllowed = allowedRoots.some((root) => resolved.startsWith(root));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Path is outside allowed directories' });
    }

    const result = importRoleLibrary(db, resolved);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ result });
  });

  return router;
}

module.exports = { createRoleTemplatesRouter };
