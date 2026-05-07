module.exports = {
  name: '006_role_templates',
  up(db) {
    db.exec(`
      CREATE TABLE role_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        default_model_profile_id TEXT,
        default_permission_profile_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (default_model_profile_id) REFERENCES model_profiles(id),
        FOREIGN KEY (default_permission_profile_id) REFERENCES permission_profiles(id)
      )
    `);
  },
};
