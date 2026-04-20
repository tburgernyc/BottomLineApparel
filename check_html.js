import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

try {
  const result = execSync('npx htmlhint --nocolor index.html', { encoding: 'utf8' });
  writeFileSync('htmlhint_out.txt', result, 'utf8');
} catch (err) {
  const out = (err.stdout || '') + (err.stderr || '');
  writeFileSync('htmlhint_out.txt', out, 'utf8');
}
console.log('done');
