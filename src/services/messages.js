const { generateId } = require('../db/helpers');
const { canContactHuman } = require('./permissions');

const VALID_MESSAGE_TYPES = [
  'question',
  'answer',
  'escalation',
  'blocker',
  'decision',
  'notification',
];

const HUMAN_FACING_ROLES = ['ceo', 'cto', 'product_manager'];

/**
 * Check if a message is allowed between two role instances via role_edges.
 */
function canMessage(db, fromRoleInstanceId, toRoleInstanceId, projectId) {
  // Check bidirectional edge
  const edge = db
    .prepare(
      `SELECT * FROM role_edges
       WHERE project_id = ?
         AND can_message = 1
         AND (
           (from_role_instance_id = ? AND to_role_instance_id = ?)
           OR
           (from_role_instance_id = ? AND to_role_instance_id = ? AND direction = 'bidirectional')
         )`,
    )
    .get(projectId, fromRoleInstanceId, toRoleInstanceId, toRoleInstanceId, fromRoleInstanceId);

  return !!edge;
}

/**
 * Check if a role instance is allowed to communicate directly with a human.
 * Only CEO, CTO, Product Manager can communicate with humans.
 */
function canCommunicateWithHuman(db, fromRoleInstanceId) {
  const instance = db
    .prepare(
      `SELECT pri.id, rt.key as role_key
       FROM project_role_instances pri
       JOIN role_templates rt ON rt.id = pri.role_template_id
       WHERE pri.id = ?`,
    )
    .get(fromRoleInstanceId);

  if (!instance) return false;
  return HUMAN_FACING_ROLES.includes(instance.role_key);
}

function sendMessage(db, data, agentId) {
  const sender = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!sender) throw new Error('Agent not found');

  const { to_agent_id, to_human_id, content_md, message_type, subject, alignment_session_id } =
    data;
  const project_id = sender.project_id;
  const from_role_instance_id = sender.role_instance_id;
  let to_role_instance_id = data.to_role_instance_id || null;
  const source_task_id = data.source_task_id || data.task_id || null;

  // Validate message type
  const type = message_type || 'notification';
  if (!VALID_MESSAGE_TYPES.includes(type)) {
    throw new Error(`Invalid message_type. Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}`);
  }

  // If sending to a human, check if sender role is allowed
  if (to_human_id) {
    if (!canContactHuman(db, agentId) || !canCommunicateWithHuman(db, from_role_instance_id)) {
      throw new Error('Your role is not allowed to communicate directly with humans');
    }
  }

  if (to_agent_id) {
    const targetAgent = db
      .prepare('SELECT * FROM agents WHERE id = ? AND project_id = ?')
      .get(to_agent_id, project_id);
    if (!targetAgent) throw new Error('Target agent not found in this project');
    to_role_instance_id = targetAgent.role_instance_id;
  }

  if (to_role_instance_id) {
    const targetRole = db
      .prepare(
        'SELECT * FROM project_role_instances WHERE id = ? AND project_id = ? AND is_active = 1',
      )
      .get(to_role_instance_id, project_id);
    if (!targetRole) throw new Error('Target role not found in this project');
  }

  if (source_task_id) {
    const task = db
      .prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?')
      .get(source_task_id, project_id);
    if (!task) throw new Error('Task not found in this project');
  }

  if (alignment_session_id) {
    const session = db
      .prepare('SELECT id FROM alignment_sessions WHERE id = ? AND project_id = ?')
      .get(alignment_session_id, project_id);
    if (!session) throw new Error('Alignment session not found in this project');
  }

  // If sending to another agent via role instances, check edge permission
  if (
    from_role_instance_id &&
    to_role_instance_id &&
    from_role_instance_id !== to_role_instance_id
  ) {
    if (!canMessage(db, from_role_instance_id, to_role_instance_id, project_id)) {
      throw new Error('Messaging not allowed between these roles');
    }
  }

  // Find or create conversation
  let conversationId = data.conversation_id;
  if (!conversationId) {
    conversationId = generateId();
    db.prepare(
      `INSERT INTO conversations (id, project_id, title, conversation_type) VALUES (?, ?, ?, ?)`,
    ).run(conversationId, project_id, subject || 'Untitled', source_task_id ? 'task' : 'general');
  } else {
    const conversation = db
      .prepare('SELECT id FROM conversations WHERE id = ? AND project_id = ?')
      .get(conversationId, project_id);
    if (!conversation) throw new Error('Conversation not found in this project');
  }

  // Create message
  const id = generateId();
  db.prepare(
    `INSERT INTO messages (id, project_id, conversation_id, from_human_id, from_agent_id,
     to_human_id, to_agent_id, from_role_instance_id, to_role_instance_id,
     source_task_id, alignment_session_id, subject, content_md, message_type, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    project_id,
    conversationId,
    null,
    agentId,
    to_human_id || null,
    to_agent_id || null,
    from_role_instance_id || null,
    to_role_instance_id || null,
    source_task_id || null,
    alignment_session_id || null,
    subject || null,
    content_md,
    type,
    data.priority || 'normal',
  );

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

function listConversations(db, projectId) {
  return db
    .prepare('SELECT * FROM conversations WHERE project_id = ? ORDER BY updated_at DESC')
    .all(projectId);
}

function getConversationMessages(db, conversationId, projectId) {
  return db
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ? AND project_id = ?
       ORDER BY created_at`,
    )
    .all(conversationId, projectId);
}

module.exports = {
  sendMessage,
  listConversations,
  getConversationMessages,
  canMessage,
  canCommunicateWithHuman,
  VALID_MESSAGE_TYPES,
};
