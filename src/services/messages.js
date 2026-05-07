const { generateId } = require('../db/helpers');

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
  const {
    project_id,
    to_agent_id,
    to_human_id,
    from_role_instance_id,
    to_role_instance_id,
    content_md,
    message_type,
    subject,
    source_task_id,
    alignment_session_id,
  } = data;

  // Validate message type
  const type = message_type || 'notification';
  if (!VALID_MESSAGE_TYPES.includes(type)) {
    throw new Error(`Invalid message_type. Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}`);
  }

  // If sending to a human, check if sender role is allowed
  if (to_human_id) {
    if (!canCommunicateWithHuman(db, from_role_instance_id)) {
      throw new Error('Your role is not allowed to communicate directly with humans');
    }
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
    data.from_human_id || null,
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

function getConversationMessages(db, conversationId) {
  return db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at')
    .all(conversationId);
}

module.exports = {
  sendMessage,
  listConversations,
  getConversationMessages,
  canMessage,
  canCommunicateWithHuman,
  VALID_MESSAGE_TYPES,
};
