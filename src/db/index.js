const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

function createDatabase(dbPath, options = {}) {
  if (_db && !options.forceNew) return _db;

  // Ensure parent directory exists for file-based databases
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Enable WAL mode for file-based databases
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  _db = db;
  return db;
}

function getDatabase() {
  if (!_db) throw new Error('Database not initialized. Call createDatabase() first.');
  return _db;
}

function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function resetForTesting() {
  closeDatabase();
}

module.exports = { createDatabase, getDatabase, closeDatabase, resetForTesting };
