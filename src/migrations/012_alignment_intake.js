module.exports = {
  name: '012_alignment_intake',
  up(db) {
    db.exec(`
      CREATE TABLE problem_statements (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        human_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (human_id) REFERENCES humans(id)
      )
    `);

    db.exec(`
      CREATE TABLE alignment_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        problem_statement_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_round INTEGER NOT NULL DEFAULT 1,
        alignment_score REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (problem_statement_id) REFERENCES problem_statements(id)
      )
    `);

    db.exec(`
      CREATE TABLE alignment_participants (
        id TEXT PRIMARY KEY,
        alignment_session_id TEXT NOT NULL,
        participant_type TEXT NOT NULL,
        human_id TEXT,
        agent_id TEXT,
        role_instance_id TEXT,
        department_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (human_id) REFERENCES humans(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    db.exec(`
      CREATE TABLE clarification_questions (
        id TEXT PRIMARY KEY,
        alignment_session_id TEXT NOT NULL,
        asked_by_agent_id TEXT,
        asked_by_role_instance_id TEXT,
        target_human_id TEXT NOT NULL,
        question_md TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'note',
        options_json TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        round_number INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        answered_at TEXT,
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (asked_by_agent_id) REFERENCES agents(id),
        FOREIGN KEY (asked_by_role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (target_human_id) REFERENCES humans(id)
      )
    `);

    db.exec(`
      CREATE TABLE clarification_answers (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        answered_by_human_id TEXT NOT NULL,
        answer_md TEXT NOT NULL,
        selected_options_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (question_id) REFERENCES clarification_questions(id),
        FOREIGN KEY (answered_by_human_id) REFERENCES humans(id)
      )
    `);

    db.exec(`
      CREATE TABLE research_notes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        alignment_session_id TEXT NOT NULL,
        created_by_agent_id TEXT,
        department_id TEXT,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        source_refs_json TEXT,
        confidence REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    db.exec(`
      CREATE TABLE alignment_reviews (
        id TEXT PRIMARY KEY,
        alignment_session_id TEXT NOT NULL,
        reviewed_by_agent_id TEXT,
        review_md TEXT NOT NULL,
        missing_info_md TEXT,
        next_questions_needed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (reviewed_by_agent_id) REFERENCES agents(id)
      )
    `);

    db.exec(`
      CREATE TABLE human_approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        alignment_session_id TEXT,
        artifact_id TEXT,
        human_id TEXT NOT NULL,
        approval_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes_md TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (human_id) REFERENCES humans(id)
      )
    `);
  },
};
