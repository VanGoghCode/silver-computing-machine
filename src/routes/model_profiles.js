const express = require('express');
const { generateId } = require('../db/helpers');

function createModelProfilesRouter(db) {
  const router = express.Router();

  router.get('/api/model-profiles', (req, res) => {
    const profiles = db
      .prepare(
        `SELECT id, key, display_name, provider, model, purpose, api_key_ref, config_json, created_at, updated_at
         FROM model_profiles ORDER BY key`,
      )
      .all();
    res.json({ profiles });
  });

  router.post('/api/model-profiles', (req, res) => {
    const { key, display_name, provider, model, purpose, api_key_ref, config_json } = req.body;
    if (!key || !display_name || !provider || !model) {
      return res.status(400).json({
        error: 'key, display_name, provider, and model are required',
      });
    }

    const existing = db.prepare('SELECT id FROM model_profiles WHERE key = ?').get(key);
    if (existing) {
      return res.status(409).json({ error: `Model profile with key '${key}' already exists` });
    }

    const id = generateId();
    const now = new Date().toISOString();
    const configStr =
      typeof config_json === 'string' ? config_json : JSON.stringify(config_json || {});

    db.prepare(
      `INSERT INTO model_profiles (id, key, display_name, provider, model, purpose, api_key_ref, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      key,
      display_name,
      provider,
      model,
      purpose || null,
      api_key_ref || null,
      configStr,
      now,
      now,
    );

    const profile = db.prepare('SELECT * FROM model_profiles WHERE id = ?').get(id);
    res.status(201).json({ profile });
  });

  router.patch('/api/model-profiles/:id', (req, res) => {
    const profile = db.prepare('SELECT * FROM model_profiles WHERE id = ?').get(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Model profile not found' });
    }

    const allowed = ['display_name', 'provider', 'model', 'purpose', 'api_key_ref', 'config_json'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] =
          field === 'config_json' && typeof req.body[field] !== 'string'
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

    db.prepare(`UPDATE model_profiles SET ${setClauses}, updated_at = ? WHERE id = ?`).run(
      ...values,
    );

    const updated = db.prepare('SELECT * FROM model_profiles WHERE id = ?').get(req.params.id);
    res.json({ profile: updated });
  });

  return router;
}

module.exports = { createModelProfilesRouter };
