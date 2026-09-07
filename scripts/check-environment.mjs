#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function supportsNode(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return Number.isInteger(major) && ((major === 22 && minor >= 13) || major >= 24);
}

export function checkEnvironment() {
  if (!supportsNode(process.versions.node)) {
    throw new Error(`Node ${process.versions.node} is unsupported for contributing. Use Node 22.13+ (22.x) or Node 24+, then run pnpm install. Run nvm install to use .nvmrc.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkEnvironment();
    console.log(`Node ${process.versions.node}: supported. Use pinned pnpm@9.5.0 via Corepack or an existing pnpm installation.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
