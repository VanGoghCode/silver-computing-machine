const GLOBAL_SECTION_ORDER = [
  'company-vision',
  'company-mission',
  'communication-rules',
  'quality-standards',
  'security-rules',
  'context-rules',
  'no-assumption-rules',
];

const ROLE_SECTION_ORDER = ['persona', 'instructions', 'rules', 'communication', 'output-format'];

const GLOBAL_TEMPLATE_ID = 'global';

function assemblePrompt(db, agentId) {
  // Get agent info
  const agent = db
    .prepare(
      `SELECT a.*, pri.role_template_id, pri.model_profile_id, pri.permission_profile_id,
              p.name as project_name, p.slug as project_slug,
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

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const roleTemplateId = agent.role_template_id;
  const roleNodeId = agent.role_instance_id;

  // Get global prompt files
  const globalFiles = db
    .prepare(`SELECT * FROM role_prompt_files WHERE role_template_id = ? AND is_active = 1`)
    .all(GLOBAL_TEMPLATE_ID);

  // Get role prompt files
  const roleFiles = db
    .prepare(`SELECT * FROM role_prompt_files WHERE role_template_id = ? AND is_active = 1`)
    .all(roleTemplateId);

  // Build sections in stable order
  const sections = [];

  for (const key of GLOBAL_SECTION_ORDER) {
    const file = globalFiles.find((f) => f.section_key === key);
    if (file) {
      sections.push({
        section_key: file.section_key,
        content_md: file.content_md,
        version: file.version,
        source: 'global',
      });
    }
  }

  for (const key of ROLE_SECTION_ORDER) {
    const file = roleFiles.find((f) => f.section_key === key);
    if (file) {
      sections.push({
        section_key: file.section_key,
        content_md: file.content_md,
        version: file.version,
        source: 'role',
      });
    }
  }

  // Permission summary
  const permProfile = agent.permission_profile_id
    ? db.prepare(`SELECT * FROM permission_profiles WHERE id = ?`).get(agent.permission_profile_id)
    : null;

  const permission_summary = permProfile
    ? {
        profile_id: permProfile.id,
        profile_key: permProfile.key,
        permissions: JSON.parse(permProfile.permissions_json || '{}'),
      }
    : { profile_id: null, profile_key: 'default', permissions: {} };

  // Identity block
  const identity = {
    agent_id: agent.id,
    agent_name: agent.name,
    project_id: agent.project_id,
    project_name: agent.project_name,
    project_slug: agent.project_slug,
    department_key: agent.department_key,
    department_name: agent.department_name,
    role_key: agent.role_key,
    role_display_name: agent.role_display_name,
    role_node_id: roleNodeId,
  };

  return {
    sections,
    permission_summary,
    identity,
  };
}

module.exports = { assemblePrompt };
