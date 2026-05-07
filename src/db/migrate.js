function runMigrations(db, migrations) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => r.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    })();
  }
}

module.exports = { runMigrations };
