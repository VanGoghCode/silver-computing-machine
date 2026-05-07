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

function normalizeLinkedArtifactIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseMarkdownList(markdown) {
  if (!markdown) return [];
  return String(markdown)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}

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
      .prepare(
        'SELECT id, project_id, status FROM context_artifacts WHERE id = ? AND project_id = ? AND is_archived = 0',
      )
      .get(artId, projectId);
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
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const projectId = agent.project_id;
  const departmentId = data.department_id || agent.department_id || null;

  if (departmentId) {
    const dept = db
      .prepare('SELECT id FROM departments WHERE id = ? AND project_id = ?')
      .get(departmentId, projectId);
    if (!dept) throw new Error('Department not found in this project');
  }

  if (data.assigned_agent_id) {
    const assigned = db
      .prepare('SELECT id, role_instance_id FROM agents WHERE id = ? AND project_id = ?')
      .get(data.assigned_agent_id, projectId);
    if (!assigned) throw new Error('Assigned agent not found in this project');
  }

  if (data.assigned_role_instance_id) {
    const role = db
      .prepare('SELECT id FROM project_role_instances WHERE id = ? AND project_id = ?')
      .get(data.assigned_role_instance_id, projectId);
    if (!role) throw new Error('Assigned role not found in this project');
  }

  const linkedArtifactIds = normalizeLinkedArtifactIds(data.linked_artifact_ids_json);
  for (const artifactId of linkedArtifactIds) {
    const artifact = db
      .prepare('SELECT id FROM context_artifacts WHERE id = ? AND project_id = ?')
      .get(artifactId, projectId);
    if (!artifact) throw new Error(`Linked artifact ${artifactId} not found in this project`);
  }

  db.prepare(
    `INSERT INTO tasks (id, project_id, department_id, lifecycle_stage, created_by_agent_id,
     assigned_agent_id, assigned_role_instance_id, title, description_md, status, priority,
     base_branch, branch_name, todo_md, acceptance_criteria_md, linked_artifact_ids_json, pipeline_iteration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    departmentId,
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
    JSON.stringify(linkedArtifactIds),
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

function getTask(db, taskId, projectId) {
  const task = projectId
    ? db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(taskId, projectId)
    : db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
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
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, agent.project_id);
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

  if (currentStatus === 'ready' && newStatus === 'assigned' && !task.assigned_agent_id) {
    throw new Error('Cannot move to assigned: assigned_agent_id is required');
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
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, agent.project_id);
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
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, agent.project_id);
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

  if (task.status === 'in_progress') {
    return moveTask(db, taskId, 'review', agentId, 'Implementation completed by worker');
  }

  if (task.status === 'testing') {
    return moveTask(db, taskId, 'done', agentId, 'Testing completed');
  }

  throw new Error(`Cannot complete task in status: ${task.status}`);
}

function failTask(db, taskId, agentId, reason, result) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, agent.project_id);
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
  const agent = db.prepare('SELECT project_id FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, agent.project_id);
  if (!task) throw new Error('Task not found');

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
  if (data.notes !== undefined && data.notes_md === undefined) {
    data.notes_md = data.notes;
  }
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
  const requester = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!requester) throw new Error('Agent not found');
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(taskId, requester.project_id);
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

  // Todos
  const todos = db
    .prepare('SELECT * FROM task_todos WHERE task_id = ? ORDER BY position')
    .all(taskId);

  const allowReviewContext = taskAllowsReviewContext(task);
  const allowedStatuses = allowReviewContext ? ['approved', 'needs_review'] : ['approved'];
  const linkedIds = normalizeLinkedArtifactIds(task.linked_artifact_ids_json);
  const latestByType = new Map();

  for (const artId of linkedIds) {
    const art = db
      .prepare(
        `SELECT id, artifact_type, title, content_md, version, lifecycle_stage, status
         FROM context_artifacts
         WHERE id = ? AND project_id = ? AND lifecycle_stage = ? AND is_archived = 0
           AND status IN (${allowedStatuses.map(() => '?').join(',')})
         ORDER BY version DESC, updated_at DESC, id DESC`,
      )
      .get(artId, task.project_id, task.lifecycle_stage, ...allowedStatuses);
    if (!art) continue;

    const current = latestByType.get(art.artifact_type);
    if (
      !current ||
      art.version > current.version ||
      (art.version === current.version && art.id > current.id)
    ) {
      latestByType.set(art.artifact_type, art);
    }
  }

  const dynamicContextItems = Array.from(latestByType.values()).sort((a, b) => {
    if (a.artifact_type !== b.artifact_type) return a.artifact_type.localeCompare(b.artifact_type);
    if (a.version !== b.version) return b.version - a.version;
    return a.id.localeCompare(b.id);
  });

  const sourceArtifacts = dynamicContextItems.map((art) => ({
    artifactId: art.id,
    artifactType: art.artifact_type,
    title: art.title,
    version: art.version,
    status: art.status,
    lifecycleStage: art.lifecycle_stage,
  }));

  const dynamicContext = dynamicContextItems
    .map(
      (art) =>
        `## ${art.title}\n` +
        `Source: ${art.id} v${art.version} (${art.artifact_type}, ${art.status}, ${art.lifecycle_stage})\n\n` +
        art.content_md,
    )
    .join('\n\n');

  // Recent relevant messages
  const recentMessages = db
    .prepare(
      `SELECT m.*, rt.key as from_role_key
       FROM messages m
       LEFT JOIN project_role_instances pri ON pri.id = m.from_role_instance_id
       LEFT JOIN role_templates rt ON rt.id = pri.role_template_id
       WHERE m.project_id = ? AND (m.source_task_id = ? OR m.source_task_id IS NULL)
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
    taskId: task.id,
    title: task.title,
    description: task.description_md,
    status: task.status,
    projectId: task.project_id,
    departmentId: task.department_id || null,
    assignedAgentId: task.assigned_agent_id || null,
    assignedAgentName: agent ? agent.agent_name : null,
    roleInstanceId: agent ? agent.role_instance_id : null,
    branch: task.branch_name || null,
    baseBranch: task.base_branch || null,
    todoList: todos.length ? todos.map((todo) => todo.content_md) : parseMarkdownList(task.todo_md),
    acceptanceCriteria: parseMarkdownList(task.acceptance_criteria_md),
    staticContext: staticPrompt
      .map((section) => `## ${section.section_key}\n${section.content_md}`)
      .join('\n\n'),
    dynamicContext,
    codebaseContext: '',
    recentMessages: recentMessages.map((message) => ({
      role: message.from_role_key || 'unknown',
      content: message.content_md || '',
      timestamp: message.created_at,
    })),
    allowedTools: deriveAllowedTools(agent),
    forbiddenActions: [
      'delete_project',
      'modify_permissions',
      'escalate_without_approval',
      'access_other_projects',
      'read_silver_repo',
    ],
    requiredOutputFormat:
      'Post task events, create context artifacts for important decisions, open a local PR when code changes are ready, and complete or fail the task through Silver.',
    dopamineInfo: 'Work only inside the assigned project and report progress through Silver.',
    sourceArtifacts,
    localPr: localPr || null,
    lifecycleStage: task.lifecycle_stage,
  };
}

function taskAllowsReviewContext(task) {
  const text = `${task.title || ''}\n${task.description_md || ''}`.toLowerCase();
  return (
    task.status === 'review' ||
    task.lifecycle_stage === 'discovery' ||
    text.includes('review') ||
    text.includes('alignment') ||
    text.includes('research') ||
    text.includes('document-review')
  );
}

function deriveAllowedTools(agent) {
  const base = [
    'query_context',
    'query_graphify',
    'post_task_event',
    'update_todo',
    'message_role',
  ];
  if (!agent) return base;

  const roleKey = agent.role_key;
  if (roleKey === 'engineer') {
    return [...base, 'read', 'write', 'edit', 'bash', 'open_local_pr', 'create_context_artifact'];
  }
  if (roleKey === 'reviewer' || roleKey === 'tester') {
    return [...base, 'read', 'grep', 'bash', 'create_context_artifact', 'open_local_pr'];
  }
  if (roleKey === 'tech_lead' || roleKey === 'project_manager') {
    return [...base, 'create_subtask', 'move_ticket', 'create_context_artifact'];
  }
  return [...base, 'create_context_artifact'];
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
