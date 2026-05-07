module.exports = {
  name: '015_conversations',
  up(db) {
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT,
        conversation_type TEXT NOT NULL DEFAULT 'general',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    db.exec(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        from_human_id TEXT,
        from_agent_id TEXT,
        to_human_id TEXT,
        to_agent_id TEXT,
        from_role_instance_id TEXT,
        to_role_instance_id TEXT,
        source_task_id TEXT,
        alignment_session_id TEXT,
        subject TEXT,
        content_md TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'notification',
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (from_human_id) REFERENCES humans(id),
        FOREIGN KEY (from_agent_id) REFERENCES agents(id),
        FOREIGN KEY (to_human_id) REFERENCES humans(id),
        FOREIGN KEY (to_agent_id) REFERENCES agents(id),
        FOREIGN KEY (from_role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (to_role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (source_task_id) REFERENCES tasks(id),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id)
      )
    `);
  },
};
