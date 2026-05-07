const ROLE_PERMISSION_FALLBACKS = {
  ceo: { can_message_human: true, can_approve_docs: true, can_manage_tasks: true },
  cto: { can_message_human: true, can_approve_tech: true, can_manage_tasks: true },
  product_manager: { can_message_human: true, can_create_requirements: true },
  project_manager: { can_manage_tasks: true },
  architect: { can_run_graphify: true },
  tech_lead: { can_assign_tickets: true, can_review_prs: true, can_approve_merge: true },
  engineer: { can_write_code: true, can_open_pr: true, can_self_review: true },
  reviewer: { can_review_prs: true, can_request_changes: true },
  tester: { can_run_tests: true, can_write_tests: true },
  git_manager: { can_merge: true, can_manage_branches: true, can_run_graphify: true },
  weekly_audit_agent: { can_read_codebase: true, can_create_audit_report: true },
};

function parsePermissions(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getAgentPermissions(db, agentId) {
  const row = db
    .prepare(
      `SELECT a.id, pri.permission_profile_id, rt.key as role_key, pp.permissions_json
       FROM agents a
       JOIN project_role_instances pri ON pri.id = a.role_instance_id
       JOIN role_templates rt ON rt.id = pri.role_template_id
       LEFT JOIN permission_profiles pp ON pp.id = pri.permission_profile_id
       WHERE a.id = ?`,
    )
    .get(agentId);

  if (!row) return { role_key: null, permissions: {} };
  const explicit = parsePermissions(row.permissions_json);
  const fallback = ROLE_PERMISSION_FALLBACKS[row.role_key] || {};
  return { role_key: row.role_key, permissions: { ...fallback, ...explicit } };
}

function hasPermission(db, agentId, permissionKey) {
  const { permissions } = getAgentPermissions(db, agentId);
  return permissions[permissionKey] === true;
}

function canApproveArtifact(db, agentId) {
  const { permissions } = getAgentPermissions(db, agentId);
  return permissions.can_approve_docs === true || permissions.can_approve_tech === true;
}

function canContactHuman(db, agentId) {
  const { permissions } = getAgentPermissions(db, agentId);
  return permissions.can_message_human === true;
}

function canMergePr(db, agentId) {
  const { permissions } = getAgentPermissions(db, agentId);
  return permissions.can_merge === true || permissions.can_approve_merge === true;
}

module.exports = {
  getAgentPermissions,
  hasPermission,
  canApproveArtifact,
  canContactHuman,
  canMergePr,
};
