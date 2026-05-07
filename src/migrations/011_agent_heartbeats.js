module.exports = {
  name: '011_agent_heartbeats',
  up(db) {
    db.exec(`
      CREATE TABLE agent_heartbeats (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        status TEXT,
        current_task_id TEXT,
        payload_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
  },
};
