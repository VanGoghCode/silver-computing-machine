module.exports = {
  name: '009_role_edges',
  up(db) {
    db.exec(`
      CREATE TABLE role_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_role_instance_id TEXT NOT NULL,
        to_role_instance_id TEXT NOT NULL,
        edge_type TEXT NOT NULL DEFAULT 'hierarchy',
        direction TEXT NOT NULL DEFAULT 'upstream',
        can_message INTEGER NOT NULL DEFAULT 0,
        can_assign_task INTEGER NOT NULL DEFAULT 0,
        can_escalate INTEGER NOT NULL DEFAULT 0,
        can_share_context INTEGER NOT NULL DEFAULT 0,
        can_request_approval INTEGER NOT NULL DEFAULT 0,
        requires_approval INTEGER NOT NULL DEFAULT 0,
        policy_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (from_role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (to_role_instance_id) REFERENCES project_role_instances(id)
      )
    `);
  },
};
