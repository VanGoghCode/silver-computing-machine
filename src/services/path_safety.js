const path = require('path');

/**
 * Resolve a path within a root directory. Returns null if the path escapes the root.
 */
function safePath(root, ...segments) {
  const joined = path.join(...segments.filter(Boolean));
  // Block null bytes
  if (joined.includes('\0')) return null;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, joined);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return null;
  }
  return resolved;
}

/**
 * Check if a path belongs to a specific project root.
 */
function isWithinProject(pathToCheck, projectRoot) {
  if (!pathToCheck || !projectRoot) return false;
  if (pathToCheck.includes('\0')) return false;
  const resolved = path.resolve(pathToCheck);
  const root = path.resolve(projectRoot);
  return resolved.startsWith(root + path.sep) || resolved === root;
}

module.exports = { safePath, isWithinProject };
