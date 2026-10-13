import { beforeAll, afterAll } from 'vitest';
import { commands } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    startLibraryCoverage(): Promise<void>;
    saveLibraryCoverage(): Promise<void>;
  }
}

beforeAll(async () => { await commands.startLibraryCoverage(); });
afterAll(async () => { await commands.saveLibraryCoverage(); });
