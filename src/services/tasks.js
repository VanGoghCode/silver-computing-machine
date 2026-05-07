const { generateId } = require('../db/helpers');

const VALID_STATUSES = ['backlog', 'ready', 'assigned', 'in_progress', 'review', 'testing', 'done'];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const MAX_PIPELINE_ITERATION = 2;

// Allowed transitions: from -> [to]
const ALLOWED_TRANSITIONS = {
  backlog: ['ready'],
  ready: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['review'],
  review: ['testing', 'in_progress', 'assigned'],
  testing: ['done', 'in_progress', 'assigned', 'review'],
  done: [],
};

/**
 * Check whether moving from->to is a pipeline-incrementing transition.
 * Review/test loops increment pipeline_iteration.
 */
function isPipelineIncrementingTransition(from, to) {
  return (
    (from === 'in_progress' && to === 'review') ||
    (from === 'review' && to === 'testing') ||
    (from === 'testing' && to === 'review')
  );
}

/**
 * Validate source-of-truth: a task can only move to ready if all linked
 * artifacts exist and are approved.
 */
function validateSourceOfTruth(db, projectId, linkedArtifactIds) {
  if (!linkedArtifactIds || linkedArtifactIds.length === 0) {
    return { valid: false, reason: 'No linked artifacts' };
  }

  for (const artId of linkedArtifactIds) {
    const art = db
      .prepare('SELECT id, status FROM context_artifacts WHERE id = ? AND is_archived = 0')
      .get(artId);
    if (!art) {
      return { valid: false, reason: `Artifact ${artId} not found` };
    }
    if (art.status !== 'approved') {
      return { valid: false, reason: `Artifact ${artId} is not approved (status: ${art.status})` };
    }
  }

  return { valid: true };
}

function createTask(db, data, agentId) {
  const id = generateId();
  db.prepare(
    `INSERT INTO tasks (id, project_id, department_id, lifecycle_stage, created_by_agent_id,
     assigned_agent_id, assigned_role_instance_id, title, description_md, status, priority,
     base_branch, branch_name, todo_md, acceptance_criteria_md, linked_artifact_ids_json, pipeline_iteration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.department_id || null,
    data.lifecycle_stage || 'discovery',
    agentId,
    data.assigned_agent_id || null,
    data.assigned_role_instance_id || null,
    data.title,
    data.description_md || '',
    'backlog',
    data.priority || 'medium',
    data.base_branch || null,
    data.branch_name || null,
    data.todo_md || null,
    data.acceptance_criteria_md || null,
    data.linked_artifact_ids_json || '[]',
    0,
  );

  // Create initial event
  const eventId = generateId();
  db.prepare(
    `INSERT INTO task_events (id, task_id, agent_id, event_type, content_md)
     VALUES (?, ?, ?, 'created', ?)`,
  ).run(eventId, id, agentId, `Task created: ${data.title}`);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function getTask(db, taskId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;

  const todos = db
    .prepare('SELECT * FROM task_todos WHERE task_id = ? ORDER BY position')
    .all(taskId);

  return { ...task, todos };
}

function listTasks(db, projectId) {
  return db
    .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId);
}

function getMyTasks(db, agentId) {
  return db
    .prepare(`SELECT * FROM tasks WHERE assigned_agent_id = ? ORDER BY created_at DESC`)
    .all(agentId);
}

function moveTask(db, taskId, newStatus, agentId, reason) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Task not found');

  const currentStatus = task.status;

  // Validate transition
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} -> ${newStatus}`);
  }

  // backlog -> ready requires source-of-truth validation
  if (currentStatus === 'backlog' && newStatus === 'ready') {
    const linkedIds = JSON.parse(task.linked_artifact_ids_json || '[]');
    const validation = validateSourceOfTruth(db, task.project_id, linkedIds);
    if (!validation.valid) {
      throw new Error(`Cannot move to ready: ${validation.reason}`);
    }
  }

  // Pipeline iteration check
  let pipelineIteration = task.pipeline_iteration;
  if (isPipelineIncrementingTransition(currentStatus, newStatus)) {
    pipelineIteration += 1;
    if (pipelineIteration > MAX_PIPELINE_ITERATION) {
      throw new Error(
        `Pipeline iteration limit (${MAX_PIPELINE_ITERATION}) reached. Task cannot re-enter review/test.`,
      );
    }
  }

  // Update task
  db.prepare(
    `UPDATE tasks SET status = ?, pipeline_iteration = ?, blocked_reason_md = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(newStatus, pipelineIteration, reason || task.blocked_reason_md, taskId);

  // Create event
  const eventId = generateId();
  const eventContent = reason
    ? `Moved from ${currentStatus} to ${newStatus}: ${reason}`
    : `Moved from ${currentStatus} to ${newStatus}`;
  db.prepare(
    `INSERT INTO task_events (id, task_id, agent_id, event_type, content_md, metadata_json)
     VALUES (?, ?, ?, 'status_change', ?, ?)`,
  ).run(
    eventId,
    taskId,
    agentId,
    eventContent,
    JSON.stringify({ from: currentStatus, to: newStatus, pipeline_iteration: pipelineIteration }),
  );

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

function claimTask(db, taskId, agentId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Task not found');

  if (task.assigned_agent_id !== agentId) {
    throw new Error('Task not assigned to this agent');
  }

  if (task.status !== 'assigned') {
    throw new Error(`Cannot claim task in status: ${task.status}`);
  }

  // Create attempt
  const attemptId = generateId();
  const attemptCount = db
    .prepare('SELECT COUNT(*) as count FROM task_attempts WHERE task_id = ?')
    .get(taskId).count;
  db.prepare(
    `INSERT INTO task_attempts (id, task_id, agent_id, attempt_number, status)
     VALUES (?, ?, ?, ?, 'in_progress')`,
  ).run(attemptId, taskId, agentId, attemptCount + 1);

  return moveTask(db, taskId, 'in_progress', agentId, 'Agent claimed task');
}

function completeTask(db, taskId, agentId, result) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Task not found');

  // Finish current attempt
  const attempt = db
    .prepare(
      `SELECT * FROM task_attempts WHERE task_id = ? AND agent_id = ? AND status = 'in_progress' ORDER BY started_at DESC`,
    )
    .get(taskId, agentId);

  if (attempt) {
    db.prepare(
      `UPDATE task_attempts SET status = 'completed', finished_at = datetime('now'), result_json = ? WHERE id = ?`,
    ).run(JSON.stringify(result || {}), attempt.id);
  }

  // Move to done via the proper chain: testing -> done
  // If task is in testing, move to done directly
  if (task.status === 'testing') {
    return moveTask(db, taskId, 'done', agentId, 'Task completed');
  }

  // Otherwise update and create event
  db.prepare(`UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(
    taskId,
  );

  const eventId = generateId();
  db.prepare(
    `INSERT INTO task_events (id, task_id, agent_id, event_type, content_md, metadata_json)
     VALUES (?, ?, ?, 'completed', ?, ?)`,
  ).run(eventId, taskId, agentId, 'Task completed', JSON.stringify(result || {}));

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

function failTask(db, taskId, agentId, reason, result) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Task not found');

  // Finish current attempt as failed
  const attempt = db
    .prepare(
      `SELECT * FROM task_attempts WHERE task_id = ? AND agent_id = ? AND status = 'in_progress' ORDER BY started_at DESC`,
    )
    .get(taskId, agentId);

  if (attempt) {
    db.prepare(
      `UPDATE task_attempts SET status = 'failed', finished_at = datetime('now'), result_json = ? WHERE id = ?`,
    ).run(JSON.stringify(result || { error: reason }), attempt.id);
  } else {
    // Create a failed attempt anyway
    const attemptId = generateId();
    const attemptCount = db
      .prepare('SELECT COUNT(*) as count FROM task_attempts WHERE task_id = ?')
      .get(taskId).count;
    db.prepare(
      `INSERT INTO task_attempts (id, task_id, agent_id, attempt_number, status, finished_at, result_json)
       VALUES (?, ?, ?, ?, 'failed', datetime('now'), ?)`,
    ).run(
      attemptId,
      taskId,
      agentId,
      attemptCount + 1,
      JSON.stringify(result || { error: reason }),
    );
  }

  // Create failure event
  const eventId = generateId();
  db.prepare(
    `INSERT INTO task_events (id, task_id, agent_id, event_type, content_md, metadata_json)
     VALUES (?, ?, ?, 'failed', ?, ?)`,
  ).run(eventId, taskId, agentId, reason || 'Task failed', JSON.stringify(result || {}));

  // Move back to assigned for retry
  if (task.status === 'in_progress') {
    db.prepare(
      `UPDATE tasks SET status = 'assigned', updated_at = datetime('now') WHERE id = ?`,
    ).run(taskId);
  }

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

function createTaskEvent(db, taskId, agentId, data) {
  const id = generateId();
  db.prepare(
    `INSERT INTO task_events (id, task_id, agent_id, event_type, content_md, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    taskId,
    agentId,
    data.event_type,
    data.content_md || null,
    JSON.stringify(data.metadata || {}),
  );

  return db.prepare('SELECT * FROM task_events WHERE id = ?').get(id);
}

function updateTodo(db, taskId, todoId, data) {
  const todo = db
    .prepare('SELECT * FROM task_todos WHERE id = ? AND task_id = ?')
    .get(todoId, taskId);
  if (!todo) throw new Error('Todo not found');

  const allowed = ['status', 'notes_md', 'content_md', 'position'];
  const updates = [];
  const values = [];

  for (const field of allowed) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(todoId);
    db.prepare(`UPDATE task_todos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM task_todos WHERE id = ?').get(todoId);
}

/**
 * Build the full execution context bundle for Crispy Adventure worker.
 */
function getExecutionContext(db, taskId, agentId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Task not found');

  // Agent identity
  const agent = db
    .prepare(
      `SELECT a.id as agent_id, a.name as agent_name, a.project_id, a.department_id, a.role_instance_id,
              pri.role_template_id, p.name as project_name, p.slug as project_slug,
              d.key as department_key, d.display_name as department_name,
              rt.key as role_key, rt.display_name as role_display_name
       FROM agents a
       JOIN project_role_instances pri ON pri.id = a.role_instance_id
       JOIN projects p ON p.id = a.project_id
       JOIN departments d ON d.id = a.department_id
       JOIN role_templates rt ON rt.id = pri.role_template_id
       WHERE a.id = ?`,
    )
    .get(agentId);

  const role = agent
    ? {
        role_key: agent.role_key,
        role_display_name: agent.role_display_name,
        role_instance_id: agent.role_instance_id,
        role_template_id: agent.role_template_id,
      }
    : null;

  const project = agent
    ? {
        project_id: agent.project_id,
        project_name: agent.project_name,
        project_slug: agent.project_slug,
      }
    : null;

  const department = agent
    ? {
        department_id: agent.department_id,
        department_key: agent.department_key,
        department_name: agent.department_name,
      }
    : null;

  // Todos
  const todos = db
    .prepare('SELECT * FROM task_todos WHERE task_id = ? ORDER BY position')
    .all(taskId);

  // Linked artifacts (dynamic context)
  const linkedIds = JSON.parse(task.linked_artifact_ids_json || '[]');
  const dynamicContext = [];
  const sourceArtifacts = [];

  for (const artId of linkedIds) {
    const art = db
      .prepare(
        `SELECT id, artifact_type, title, content_md, version, lifecycle_stage, status
         FROM context_artifacts WHERE id = ? AND is_archived = 0`,
      )
      .get(artId);
    if (art) {
      dynamicContext.push({
        artifact_id: art.id,
        artifact_type: art.artifact_type,
        title: art.title,
        content_md: art.content_md,
        version: art.version,
        lifecycle_stage: art.lifecycle_stage,
        status: art.status,
      });
      sourceArtifacts.push({
        artifact_id: art.id,
        artifact_type: art.artifact_type,
        version: art.version,
        status: art.status,
      });
    }
  }

  // Recent relevant messages
  const recentMessages = db
    .prepare(
      `SELECT * FROM messages WHERE project_id = ? AND (source_task_id = ? OR source_task_id IS NULL)
       ORDER BY created_at DESC LIMIT 10`,
    )
    .all(task.project_id, taskId);

  // Local PR if exists
  const localPr = db.prepare('SELECT * FROM local_prs WHERE task_id = ?').get(taskId);

  // Static prompt context
  const globalFiles = db
    .prepare(`SELECT * FROM role_prompt_files WHERE role_template_id = 'global' AND is_active = 1`)
    .all();
  const roleFiles = agent
    ? db
        .prepare(`SELECT * FROM role_prompt_files WHERE role_template_id = ? AND is_active = 1`)
        .all(agent.role_template_id)
    : [];

  const staticPrompt = [...globalFiles, ...roleFiles].map((f) => ({
    section_key: f.section_key,
    content_md: f.content_md,
    version: f.version,
    source: f.role_template_id === 'global' ? 'global' : 'role',
  }));

  return {
    agent: agent
      ? {
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
        }
      : null,
    role,
    project,
    department,
    task: {
      id: task.id,
      title: task.title,
      description_md: task.description_md,
      status: task.status,
      priority: task.priority,
      lifecycle_stage: task.lifecycle_stage,
      acceptance_criteria_md: task.acceptance_criteria_md,
      linked_artifact_ids_json: task.linked_artifact_ids_json,
    },
    lifecycle_stage: task.lifecycle_stage,
    todos,
    acceptance_criteria_md: task.acceptance_criteria_md,
    branch_info: {
      base_branch: task.base_branch,
      branch_name: task.branch_name,
    },
    static_prompt: staticPrompt,
    dynamic_context: dynamicContext,
    recent_messages: recentMessages,
    local_pr: localPr || null,
    allowed_tools: ['read', 'write', 'edit', 'search', 'bash', 'glob', 'grep'],
    forbidden_actions: ['delete_project', 'modify_permissions', 'escalate_without_approval'],
    dopamine_info: { placeholder: true },
    source_artifacts: sourceArtifacts,
  };
}

module.exports = {
  createTask,
  getTask,
  listTasks,
  getMyTasks,
  moveTask,
  claimTask,
  completeTask,
  failTask,
  createTaskEvent,
  updateTodo,
  getExecutionContext,
  VALID_STATUSES,
  VALID_PRIORITIES,
};
