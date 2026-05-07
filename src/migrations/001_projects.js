module.exports = {
  name: '001_projects',
  up(db) {
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        root_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_phase TEXT DEFAULT 'discovery',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
