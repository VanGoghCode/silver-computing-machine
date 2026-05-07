const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // Projects
  listProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Problem Statements
  listProblemStatements: (projectId) => request(`/projects/${projectId}/problem-statements`),
  createProblemStatement: (projectId, data) =>
    request(`/projects/${projectId}/problem-statements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Alignment Sessions
  listAlignmentSessions: (projectId) => request(`/projects/${projectId}/alignment-sessions`),
  createAlignmentSession: (projectId, data) =>
    request(`/projects/${projectId}/alignment-sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAlignmentSession: (id) => request(`/alignment-sessions/${id}`),

  // Clarification Questions
  listQuestions: (sessionId) => request(`/alignment-sessions/${sessionId}/questions`),
  createQuestion: (sessionId, data) =>
    request(`/alignment-sessions/${sessionId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  answerQuestion: (questionId, data) =>
    request(`/questions/${questionId}/answer`, { method: 'POST', body: JSON.stringify(data) }),
  listAnswers: (sessionId) => request(`/alignment-sessions/${sessionId}/answers`),

  // Research Notes
  listResearchNotes: (sessionId) => request(`/alignment-sessions/${sessionId}/research-notes`),

  // Alignment Reviews
  submitReview: (sessionId, data) =>
    request(`/alignment-sessions/${sessionId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Human Approvals
  listApprovals: (projectId) => request(`/projects/${projectId}/approvals`),
  createApproval: (projectId, data) =>
    request(`/projects/${projectId}/approvals`, { method: 'POST', body: JSON.stringify(data) }),
  patchApproval: (id, data) =>
    request(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAlignmentStatus: (projectId) => request(`/projects/${projectId}/alignment-status`),

  // Context Artifacts
  listArtifacts: (projectId, params = '') =>
    request(`/projects/${projectId}/context-artifacts${params}`),
  getArtifact: (id) => request(`/context-artifacts/${id}`),
  createArtifact: (data) =>
    request('/context-artifacts', { method: 'POST', body: JSON.stringify(data) }),
  reviseArtifact: (id, data) =>
    request(`/context-artifacts/${id}/revise`, { method: 'POST', body: JSON.stringify(data) }),
  approveArtifact: (id) => request(`/context-artifacts/${id}/approve`, { method: 'POST' }),
  rejectArtifact: (id) => request(`/context-artifacts/${id}/reject`, { method: 'POST' }),
  archiveArtifact: (id) => request(`/context-artifacts/${id}/archive`, { method: 'POST' }),

  // Document Sets
  listDocumentSets: (projectId) => request(`/projects/${projectId}/document-sets`),
  createDocumentSet: (projectId, data) =>
    request(`/projects/${projectId}/document-sets`, { method: 'POST', body: JSON.stringify(data) }),
  getDocumentSet: (id) => request(`/document-sets/${id}`),
  approveDocumentSet: (id) => request(`/document-sets/${id}/approve`, { method: 'POST' }),

  // Role Templates
  listRoleTemplates: () => request('/role-templates'),

  // Role Nodes
  listRoleNodes: (projectId) => request(`/projects/${projectId}/role-nodes`),
  createRoleNode: (projectId, data) =>
    request(`/projects/${projectId}/role-nodes`, { method: 'POST', body: JSON.stringify(data) }),
  updateRoleNode: (projectId, nodeId, data) =>
    request(`/projects/${projectId}/role-nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRoleNode: (projectId, nodeId) =>
    request(`/projects/${projectId}/role-nodes/${nodeId}`, { method: 'DELETE' }),

  // Role Edges
  listRoleEdges: (projectId) => request(`/projects/${projectId}/role-edges`),
  createRoleEdge: (projectId, data) =>
    request(`/projects/${projectId}/role-edges`, { method: 'POST', body: JSON.stringify(data) }),
  updateRoleEdge: (projectId, edgeId, data) =>
    request(`/projects/${projectId}/role-edges/${edgeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRoleEdge: (projectId, edgeId) =>
    request(`/projects/${projectId}/role-edges/${edgeId}`, { method: 'DELETE' }),

  // Agents
  listAgents: () => request('/agents'),

  // Tasks
  listTasks: (projectId) => request(`/tasks?project_id=${projectId}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  getTask: (id) => request(`/tasks/${id}`),
  moveTask: (id, data) =>
    request(`/tasks/${id}/move`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Conversations
  listConversations: (projectId) => request(`/conversations?project_id=${projectId}`),
  getMessages: (conversationId) => request(`/conversations/${conversationId}/messages`),
  sendMessage: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),

  // Local PRs
  listLocalPrs: (projectId) => request(`/local-prs?project_id=${projectId}`),
  getLocalPr: (id) => request(`/local-prs/${id}`),
  createLocalPr: (data) => request('/local-prs', { method: 'POST', body: JSON.stringify(data) }),
  updateLocalPr: (id, data) =>
    request(`/local-prs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Graphify
  runGraphify: (projectId) =>
    request(`/projects/${projectId}/graphify/run`, { method: 'POST', body: JSON.stringify({}) }),
  listGraphifyRuns: (projectId) => request(`/projects/${projectId}/graphify/runs`),

  // Audits
  runAudit: (projectId) =>
    request(`/projects/${projectId}/audits/run`, { method: 'POST', body: JSON.stringify({}) }),
  listAuditRuns: (projectId) => request(`/projects/${projectId}/audits`),

  // Reports
  createDailyReport: (projectId) =>
    request(`/projects/${projectId}/reports/daily`, { method: 'POST', body: JSON.stringify({}) }),
  listReports: (projectId) => request(`/projects/${projectId}/reports`),

  // Model Profiles
  listModelProfiles: () => request('/model-profiles'),

  // Permission Profiles
  listPermissionProfiles: () => request('/permission-profiles'),

  // Source of truth validation
  validateSourceOfTruth: (projectId, lifecycleStage = 'mvp') =>
    request(`/projects/${projectId}/validate-source-of-truth`, {
      method: 'POST',
      body: JSON.stringify({ lifecycle_stage: lifecycleStage }),
    }),
};
