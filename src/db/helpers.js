const crypto = require('crypto');

function generateId() {
  return crypto.randomUUID();
}

function withTransaction(db, fn) {
  const result = db.transaction(fn)();
  return result;
}

module.exports = { generateId, withTransaction };
