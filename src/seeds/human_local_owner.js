module.exports = {
  name: 'human_local_owner',
  run(db) {
    db.prepare(
      `
      INSERT OR IGNORE INTO humans (id, display_name, role)
      VALUES (?, ?, ?)
    `,
    ).run('human_local_owner', 'Local Owner', 'local_owner');
  },
};
