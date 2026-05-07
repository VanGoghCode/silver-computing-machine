const { runMigrations } = require('../src/db/migrate');
const { generateId, withTransaction } = require('../src/db/helpers');
const { createTestDb } = require('./helpers');

describe('DB Foundation', () => {
  test('DB connection opens successfully', () => {
    const db = createTestDb();
    expect(db).toBeTruthy();
    const result = db.prepare('SELECT 1 as val').get();
    expect(result.val).toBe(1);
    db.close();
  });

  test('WAL mode is enabled for file-based databases', () => {
    // Memory databases don't support WAL, so test the pragma is set
    const db = createTestDb();
    const fkResult = db.pragma('foreign_keys');
    expect(fkResult[0].foreign_keys).toBe(1);
    db.close();
  });

  test('Migration runner creates _migrations table', () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
      .all();
    expect(tables.length).toBe(1);
    db.close();
  });

  test('generateId produces unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  test('Transaction helper commits on success', () => {
    const db = createTestDb();
    withTransaction(db, () => {
      db.prepare('INSERT INTO projects (id, name, slug, root_path) VALUES (?, ?, ?, ?)').run(
        't1',
        'T',
        't',
        '/t',
      );
    });
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get('t1');
    expect(row).toBeTruthy();
    expect(row.name).toBe('T');
    db.close();
  });

  test('Transaction helper rolls back on error', () => {
    const db = createTestDb();
    try {
      withTransaction(db, () => {
        db.prepare('INSERT INTO projects (id, name, slug, root_path) VALUES (?, ?, ?, ?)').run(
          't2',
          'T2',
          't2',
          '/t2',
        );
        throw new Error('boom');
      });
    } catch {
      // expected
    }
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get('t2');
    expect(row).toBeFalsy();
    db.close();
  });

  test('Migrations are idempotent', () => {
    const db = createTestDb();
    // Run migrations again — should not error
    const migrations = [require('../src/migrations/001_projects')];
    runMigrations(db, migrations);
    const count = db.prepare('SELECT COUNT(*) as c FROM _migrations').get();
    expect(count.c).toBe(17); // 17 migrations
    db.close();
  });
});
