import { readFileSync } from 'fs';

const content = readFileSync('htmlhint_out.txt', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].replace(/\s+/g, ' ').trim();
  if (trimmed) {
    // print word by word to avoid truncation
    const words = trimmed.split(' ');
    let chunk = `L${i+1}: `;
    for (const w of words) {
      chunk += w + ' ';
      if (chunk.length > 60) {
        process.stdout.write(chunk.trim() + '\n');
        chunk = '  ';
      }
    }
    if (chunk.trim()) process.stdout.write(chunk.trim() + '\n');
  }
}
