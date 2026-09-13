import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

async function statOrNull(path) {
  return lstat(path).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}

async function readTree(directory, base = '') {
  const files = [];
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(base, item.name);
    if (item.isSymbolicLink()) throw new Error(`Skill contains a symbolic link: ${path}`);
    if (item.isDirectory()) files.push(...await readTree(join(directory, item.name), path));
    else if (item.isFile()) files.push({ path, content: await readFile(join(directory, item.name)) });
    else throw new Error(`Skill contains an unsupported file: ${path}`);
  }
  return files;
}

/** Read and compare every skill before modifying the consumer's project. */
export async function planSkills(packageRoot, projectRoot) {
  const source = join(packageRoot, 'skills');
  const sourceStat = await statOrNull(source);
  if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error('Packaged AI skills are missing. Reinstall @awc-ui/core, or build its package documentation before running --skills from source.');
  }

  // Never follow a project-local alias into global or another project's skills.
  for (const path of [join(projectRoot, '.agents'), join(projectRoot, '.agents/skills')]) {
    const stat = await statOrNull(path);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Cannot install project-local skills: ${path} must be a directory, not a file or symbolic link.`);
    }
  }

  const skills = [];
  for (const item of (await readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!item.isDirectory() || item.isSymbolicLink()) throw new Error(`Invalid packaged skill directory: ${item.name}`);
    const files = await readTree(join(source, item.name));
    if (!files.some(file => file.path === 'SKILL.md')) throw new Error(`Packaged skill ${item.name} has no SKILL.md.`);
    const path = join('.agents/skills', item.name);
    const destination = join(projectRoot, path);
    const stat = await statOrNull(destination);
    let state = 'created';
    if (stat) {
      state = 'conflict';
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        // Extra consumer files and symlinks count as customization too.
        let existing;
        try { existing = await readTree(destination); }
        catch (error) {
          if (!error.message.startsWith('Skill contains ')) throw error;
        }
        if (existing?.length === files.length && files.every((file, index) =>
          existing[index].path === file.path && existing[index].content.equals(file.content))) state = 'up to date';
      }
    }
    skills.push({ path, destination, files, state });
  }
  if (!skills.length) throw new Error('No packaged AI skills were found. Reinstall @awc-ui/core.');
  return skills;
}

/** Install only wholly absent directories; customized skills are never overwritten. */
export async function writeSkills(skills) {
  if (skills.some(skill => skill.state === 'conflict')) throw new Error('Resolve existing skill conflicts before installing.');
  for (const skill of skills.filter(skill => skill.state === 'created')) {
    await mkdir(dirname(skill.destination), { recursive: true });
    // Exclusive directory creation also protects changes made since the preflight.
    await mkdir(skill.destination);
    for (const file of skill.files) {
      const target = join(skill.destination, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, { flag: 'wx' });
    }
  }
}
