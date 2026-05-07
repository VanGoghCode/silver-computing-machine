const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateId } = require('../db/helpers');

function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function importRoleLibrary(db, libraryPath) {
  let templatesCreated = 0;
  let filesImported = 0;

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO role_templates (id, key, display_name, description)
    VALUES (?, ?, ?, ?)
  `);

  // Ensure global virtual template exists
  insertTemplate.run(
    'global',
    'global',
    'Global Context',
    'Shared global context files for all roles',
  );

  const findActiveFile = db.prepare(`
    SELECT * FROM role_prompt_files
    WHERE role_template_id = ? AND section_key = ? AND is_active = 1
  `);

  const deactivateFile = db.prepare(`
    UPDATE role_prompt_files SET is_active = 0, updated_at = datetime('now')
    WHERE role_template_id = ? AND section_key = ? AND is_active = 1
  `);

  const insertFile = db.prepare(`
    INSERT INTO role_prompt_files (id, role_template_id, file_name, section_key, content_md, content_hash, version, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // Import global files
  const globalDir = path.join(libraryPath, 'global');
  if (fs.existsSync(globalDir)) {
    const globalFiles = fs.readdirSync(globalDir).filter((f) => f.endsWith('.md'));
    for (const file of globalFiles) {
      const content = fs.readFileSync(path.join(globalDir, file), 'utf-8').trim();
      const sectionKey = path.basename(file, '.md');
      const hash = computeHash(content);

      const existing = findActiveFile.get('global', sectionKey);
      if (existing) {
        if (existing.content_hash !== hash) {
          deactivateFile.run('global', sectionKey);
          insertFile.run(
            generateId(),
            'global',
            file,
            sectionKey,
            content,
            hash,
            existing.version + 1,
          );
          filesImported++;
        }
      } else {
        insertFile.run(generateId(), 'global', file, sectionKey, content, hash, 1);
        filesImported++;
      }
    }
  }

  // Import role files
  const rolesDir = path.join(libraryPath, 'roles');
  if (fs.existsSync(rolesDir)) {
    const roleDirs = fs
      .readdirSync(rolesDir)
      .filter((f) => fs.statSync(path.join(rolesDir, f)).isDirectory());

    for (const roleKey of roleDirs) {
      const roleDir = path.join(rolesDir, roleKey);

      // Ensure template exists
      let template = db.prepare(`SELECT * FROM role_templates WHERE key = ?`).get(roleKey);
      if (!template) {
        const id = generateId();
        const displayName = roleKey
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        insertTemplate.run(id, roleKey, displayName, '');
        template = { id };
        templatesCreated++;
      }

      const files = fs.readdirSync(roleDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const sectionKey = path.basename(file, '.md');
        const content = fs.readFileSync(path.join(roleDir, file), 'utf-8').trim();
        const hash = computeHash(content);

        const existing = findActiveFile.get(template.id, sectionKey);
        if (existing) {
          if (existing.content_hash !== hash) {
            deactivateFile.run(template.id, sectionKey);
            insertFile.run(
              generateId(),
              template.id,
              file,
              sectionKey,
              content,
              hash,
              existing.version + 1,
            );
            filesImported++;
          }
        } else {
          insertFile.run(generateId(), template.id, file, sectionKey, content, hash, 1);
          filesImported++;
        }
      }
    }
  }

  return { templatesCreated, filesImported };
}

module.exports = { importRoleLibrary };
