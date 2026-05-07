module.exports = {
  name: '004_model_profiles',
  up(db) {
    db.exec(`
      CREATE TABLE model_profiles (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        purpose TEXT,
        api_key_ref TEXT,
        config_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
