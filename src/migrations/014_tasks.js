module.exports = {
  name: '014_tasks',
  up(db) {
    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT,
        lifecycle_stage TEXT NOT NULL DEFAULT 'discovery',
        created_by_agent_id TEXT,
        created_by_human_id TEXT,
        assigned_agent_id TEXT,
        assigned_role_instance_id TEXT,
        title TEXT NOT NULL,
        description_md TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'backlog',
        priority TEXT NOT NULL DEFAULT 'medium',
        base_branch TEXT,
        branch_name TEXT,
        todo_md TEXT,
        acceptance_criteria_md TEXT,
        linked_artifact_ids_json TEXT DEFAULT '[]',
        pipeline_iteration INTEGER NOT NULL DEFAULT 0,
        blocked_reason_md TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id),
        FOREIGN KEY (created_by_human_id) REFERENCES humans(id),
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id),
        FOREIGN KEY (assigned_role_instance_id) REFERENCES project_role_instances(id)
      )
    `);

    db.exec(`
      CREATE TABLE task_todos (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        content_md TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes_md TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.exec(`
      CREATE TABLE task_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_id TEXT,
        event_type TEXT NOT NULL,
        content_md TEXT,
        metadata_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);

    db.exec(`
      CREATE TABLE task_attempts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_id TEXT,
        attempt_number INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'in_progress',
        started_at TEXT DEFAULT (datetime('now')),
        finished_at TEXT,
        result_json TEXT DEFAULT '{}',
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
  },
};
