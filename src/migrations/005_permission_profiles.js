module.exports = {
  name: '005_permission_profiles',
  up(db) {
    db.exec(`
      CREATE TABLE permission_profiles (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        permissions_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
