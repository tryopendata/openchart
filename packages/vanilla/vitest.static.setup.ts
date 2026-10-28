import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default function setup(): void {
  const root = path.resolve(import.meta.dirname, '../..');
  for (const name of ['core', 'engine', 'vanilla']) {
    execFileSync('bun', ['run', '--filter', `@opendata-ai/openchart-${name}`, 'build'], {
      cwd: root,
      stdio: 'pipe',
    });
  }
}
