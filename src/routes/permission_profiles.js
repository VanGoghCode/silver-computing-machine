const express = require('express');
const { generateId } = require('../db/helpers');

function createPermissionProfilesRouter(db) {
  const router = express.Router();

  router.get('/api/permission-profiles', (req, res) => {
    const profiles = db
      .prepare(
        `SELECT id, key, display_name, permissions_json, created_at, updated_at
         FROM permission_profiles ORDER BY key`,
      )
      .all();
    res.json({ profiles });
  });

  router.post('/api/permission-profiles', (req, res) => {
    const { key, display_name, permissions_json } = req.body;
    if (!key || !display_name) {
      return res.status(400).json({ error: 'key and display_name are required' });
    }

    const existing = db.prepare('SELECT id FROM permission_profiles WHERE key = ?').get(key);
    if (existing) {
      return res.status(409).json({ error: `Permission profile with key '${key}' already exists` });
    }

    const id = generateId();
    const now = new Date().toISOString();
    const permStr =
      typeof permissions_json === 'string'
        ? permissions_json
        : JSON.stringify(permissions_json || {});

    db.prepare(
      `INSERT INTO permission_profiles (id, key, display_name, permissions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, key, display_name, permStr, now, now);

    const profile = db.prepare('SELECT * FROM permission_profiles WHERE id = ?').get(id);
    res.status(201).json({ profile });
  });

  router.patch('/api/permission-profiles/:id', (req, res) => {
    const profile = db.prepare('SELECT * FROM permission_profiles WHERE id = ?').get(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Permission profile not found' });
    }

    const allowed = ['display_name', 'permissions_json'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] =
          field === 'permissions_json' && typeof req.body[field] !== 'string'
            ? JSON.stringify(req.body[field])
            : req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];

    db.prepare(`UPDATE permission_profiles SET ${setClauses}, updated_at = ? WHERE id = ?`).run(
      ...values,
    );

    const updated = db.prepare('SELECT * FROM permission_profiles WHERE id = ?').get(req.params.id);
    res.json({ profile: updated });
  });

  return router;
}

module.exports = { createPermissionProfilesRouter };
