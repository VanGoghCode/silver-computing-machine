module.exports = {
  name: '017_runtime_status',
  up(db) {
    db.exec(`ALTER TABLE projects ADD COLUMN runtime_status TEXT NOT NULL DEFAULT 'stopped'`);
  },
};
