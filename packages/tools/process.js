import { spawn } from 'node:child_process';

const ALLOWLIST = Object.freeze({
  'node-version': { command: process.execPath, args: ['--version'] },
  'npm-test': { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['test'] },
  'npm-check': { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'check'] },
  'git-diff': { command: 'git', args: ['diff', '--no-ext-diff', '--no-color'] }
});

export function allowedCommands() { return Object.keys(ALLOWLIST); }

export function runAllowed(cwd, name, extraArgs = []) {
  const spec = ALLOWLIST[name];
  if (!spec) return Promise.reject(new Error('command-not-allowed'));
  if (!Array.isArray(extraArgs) || extraArgs.some((arg) => typeof arg !== 'string')) return Promise.reject(new Error('invalid-command-args'));
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, [...spec.args, ...extraArgs], { cwd, shell: false, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}
