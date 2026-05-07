const path = require('path');

function loadConfig() {
  const port = parseInt(process.env.PORT || '4000', 10);
  const workspaceDir = process.env.WORKSPACE_DIR || '/workspace';
  const projectsDir = process.env.PROJECTS_DIR || path.join(workspaceDir, 'Projects');
  const dbPath =
    process.env.SQLITE_DB_PATH || process.env.DATABASE_URL || path.join('data', 'silver.db');

  return {
    port,
    workspaceDir,
    projectsDir,
    dbPath,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

module.exports = { loadConfig };
