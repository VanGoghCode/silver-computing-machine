const path = require('path');
const { safePath, isWithinProject } = require('../src/services/path_safety');

describe('Path Safety', () => {
  const root = '/workspace/Projects/Project-A';

  test('Path within project root is allowed', () => {
    const result = safePath(root, 'src', 'index.js');
    expect(result).toBe(path.resolve(root, 'src', 'index.js'));
  });

  test('Path traversal with ../ is blocked', () => {
    const result = safePath(root, '..', 'Project-B', 'secret.js');
    expect(result).toBeNull();
  });

  test('Multiple ../ traversal is blocked', () => {
    const result = safePath(root, '..', '..', 'etc', 'passwd');
    expect(result).toBeNull();
  });

  test('Absolute path outside project is blocked', () => {
    const result = safePath(root, '/etc/passwd');
    // path.resolve will resolve this as-is since it's absolute
    // safePath should block it because it doesn't start with root
    expect(result).toBeNull();
  });

  test('Null byte injection is blocked', () => {
    const result = safePath(root, 'file\x00.txt');
    expect(result).toBeNull();
  });

  test('Empty segments resolve to root', () => {
    const result = safePath(root, '', '');
    expect(result).toBe(path.resolve(root));
  });

  test('Exact root path is allowed', () => {
    const result = safePath(root, '');
    expect(result).toBe(path.resolve(root));
  });

  describe('Project Isolation', () => {
    const projectA = '/workspace/Projects/Project-A';

    test('isWithinProject allows own project path', () => {
      expect(isWithinProject('/workspace/Projects/Project-A/src/app.js', projectA)).toBe(true);
    });

    test('isWithinProject blocks other project path', () => {
      expect(isWithinProject('/workspace/Projects/Project-B/src/app.js', projectA)).toBe(false);
    });

    test('isWithinProject blocks null bytes', () => {
      expect(isWithinProject('/workspace/Projects/Project-A/file\x00.txt', projectA)).toBe(false);
    });

    test('isWithinProject allows exact root', () => {
      expect(isWithinProject(projectA, projectA)).toBe(true);
    });

    test('isWithinProject rejects paths that only prefix-match', () => {
      // Project-A-Extra should not match Project-A
      expect(isWithinProject('/workspace/Projects/Project-A-Extra/file.js', projectA)).toBe(false);
    });
  });
});
