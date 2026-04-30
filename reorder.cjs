const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// === 1. Update nav: "The Craft" → "Shop" pointing to #tshirts, add "The Craft" after ===
html = html.replace(
  `<a href="#material">The Craft</a>\n        <a href="#tshirts">Collection</a>`,
  `<a href="#tshirts">Shop</a>\n        <a href="#material">The Craft</a>`
);

// === 2. Extract sections from <main> ===
const mainMatch = html.match(/(<main[^>]*>)([\s\S]*?)(<\/main>)/);
if (!mainMatch) { console.error('Could not find <main>'); process.exit(1); }

const beforeMain = html.substring(0, mainMatch.index) + mainMatch[1];
const afterMain = mainMatch[3] + html.substring(mainMatch.index + mainMatch[0].length);
const mainBody = mainMatch[2];

// Extract each section by its id or comment markers
function extractSection(body, startPattern, endPattern) {
  const startIdx = body.indexOf(startPattern);
  if (startIdx === -1) return { section: '', remaining: body };
  
  // Look for the <hr> before the section (if any, within 100 chars before)
  let actualStart = startIdx;
  const before = body.substring(Math.max(0, startIdx - 120), startIdx);
  const hrIdx = before.lastIndexOf('<hr');
  if (hrIdx !== -1) {
    actualStart = startIdx - (before.length - hrIdx);
  }
  // Also grab the comment line before the section
  const commentBefore = body.substring(Math.max(0, actualStart - 200), actualStart);
  const commentIdx = commentBefore.lastIndexOf('<!-- ═');
  if (commentIdx !== -1) {
    actualStart = actualStart - (commentBefore.length - commentIdx);
  }
  
  const endIdx = body.indexOf(endPattern, startIdx);
  if (endIdx === -1) return { section: '', remaining: body };
  const sectionEnd = endIdx + endPattern.length;
  
  const section = body.substring(actualStart, sectionEnd).trim();
  const remaining = body.substring(0, actualStart) + '\n\n' + body.substring(sectionEnd);
  return { section, remaining };
}

// Extract sections in reverse order (from bottom) to avoid index shifting
let body = mainBody;
const sections = {};

// Join section
let r = extractSection(body, 'id="join"', '</section>\n    </section>');
// Actually, let's use a simpler approach - split by section tags
// Parse sections by finding each <section and its closing </section>

function extractById(body, id) {
  const sectionStart = body.indexOf(`id="${id}"`);
  if (sectionStart === -1) return { section: '', body };
  
  // Walk backwards to find the section opening tag or hr/comment
  let blockStart = sectionStart;
  // Find the <section that contains this id
  const beforeSection = body.substring(Math.max(0, sectionStart - 300), sectionStart);
  const secTagIdx = beforeSection.lastIndexOf('<section');
  if (secTagIdx !== -1) {
    blockStart = sectionStart - (beforeSection.length - secTagIdx);
  }
  
  // Also grab preceding <hr> and <!-- comment -->
  const beforeBlock = body.substring(Math.max(0, blockStart - 200), blockStart).trimEnd();
  let prefix = '';
  const hrMatch = beforeBlock.match(/<hr[^>]*\/?>[\s]*$/);
  if (hrMatch) {
    blockStart -= (beforeBlock.length - beforeBlock.lastIndexOf('<hr'));
  }
  const commentLines = body.substring(Math.max(0, blockStart - 200), blockStart).trimEnd();
  const cmtMatch = commentLines.match(/<!--[^>]+-->\s*$/);
  if (cmtMatch) {
    blockStart -= (commentLines.length - commentLines.lastIndexOf('<!--'));
  }
  
  // Find closing </section> - count nesting
  let depth = 0;
  let i = body.indexOf('<section', blockStart);
  let blockEnd = -1;
  let searchPos = i;
  
  while (searchPos < body.length) {
    const nextOpen = body.indexOf('<section', searchPos + 1);
    const nextClose = body.indexOf('</section>', searchPos);
    
    if (nextClose === -1) break;
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      searchPos = nextOpen + 1;
    } else {
      if (depth === 0) {
        blockEnd = nextClose + '</section>'.length;
        break;
      }
      depth--;
      searchPos = nextClose + 1;
    }
  }
  
  if (blockEnd === -1) return { section: '', body };
  
  const section = body.substring(blockStart, blockEnd).trim();
  const newBody = body.substring(0, blockStart) + body.substring(blockEnd);
  return { section, body: newBody };
}

// Extract each section by id
let remaining = mainBody;
const ids = ['tshirts', 'material', 'countdown', 'campaign', 'lookbook', 'story', 'apparel', 'phone-cases', 'lifestyle', 'join'];
const extracted = {};

for (const id of ids) {
  const result = extractById(remaining, id);
  extracted[id] = result.section;
  remaining = result.body;
  if (!result.section) console.warn('WARNING: Could not extract section:', id);
}

// === 3. Add hero headline to tshirts section ===
extracted['tshirts'] = extracted['tshirts'].replace(
  `<p class="edition-label reveal">The Collection</p>`,
  `<h1 class="hero-headline lux-title reveal">Your Ass Deserves<br />a Punchline.</h1>
        <p class="edition-label reveal">The Collection</p>`
);

// === 4. Reassemble in new order ===
const newOrder = [
  extracted['tshirts'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['apparel'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['phone-cases'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['lifestyle'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['material'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['countdown'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['campaign'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['lookbook'],
  '',
  extracted['story'],
  '',
  '    <hr class="section-rule" aria-hidden="true" />',
  extracted['join'],
];

const newMain = '\n\n    ' + newOrder.join('\n') + '\n\n';
const newHtml = beforeMain + newMain + afterMain;

fs.writeFileSync('index.html', newHtml);
console.log('✅ Sections reordered successfully!');
console.log('New order: Tshirts → Apparel → Phone Cases → Lifestyle → The Craft → Countdown → Campaign → Lookbook → Story → Join');
