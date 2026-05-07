module.exports = {
  name: '002_humans',
  up(db) {
    db.exec(`
      CREATE TABLE humans (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
