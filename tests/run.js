#!/usr/bin/env node
/**
 * Test runner wrapper that translates --toy and --browser flags
 * into Playwright test CLI arguments.
 *
 * Usage:
 *   node tests/run.js                             # all tests, all browsers
 *   node tests/run.js --toy constellation-engine   # single toy
 *   node tests/run.js --browser firefox            # single browser
 *   node tests/run.js --toy volcano-drum --browser chromium
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const pwArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--toy' && args[i + 1]) {
    pwArgs.push(`tests/${args[i + 1]}.test.js`);
    i++;
  } else if (args[i] === '--browser' && args[i + 1]) {
    pwArgs.push('--project', args[i + 1]);
    i++;
  } else {
    // Pass through any other flags directly to Playwright
    pwArgs.push(args[i]);
  }
}

const cmd = `npx playwright test ${pwArgs.join(' ')}`;
try {
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
} catch {
  process.exit(1);
}
