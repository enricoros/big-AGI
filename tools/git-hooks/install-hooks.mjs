import { execFileSync } from 'node:child_process';


function inGitRepo() {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!inGitRepo())
  process.exit(0);

try {
  const currentHooksPath = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (currentHooksPath === '.githooks')
    process.exit(0);
} catch {
  // No local hooks path configured yet.
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
console.log('Configured local git hooks: core.hooksPath=.githooks');
