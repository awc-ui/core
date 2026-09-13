#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadCatalog } from '../src/catalog.mjs';
import { createServer } from '../src/server.mjs';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('awc-ui-mcp\n\nRead-only AWC UI Core documentation server over MCP stdio.\nLaunch without arguments from your MCP client. No API key or network access required.');
} else if (process.argv.length > 2) {
  console.error('Unknown argument. Use awc-ui-mcp --help.');
  process.exitCode = 1;
} else {
  try {
    const catalog = await loadCatalog();
    await serveStdio(() => createServer(catalog));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
