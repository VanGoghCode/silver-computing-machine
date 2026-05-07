module.exports = {
  name: '003_departments',
  up(db) {
    db.exec(`
      CREATE TABLE departments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        UNIQUE (project_id, key)
      )
    `);
  },
};
