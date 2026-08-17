#!/usr/bin/env node
/**
 * Parse Ollama models from HTML (sorted by newest for stable ordering)
 *
 * Usage:
 *   1. Fetch HTML: curl -s "https://ollama.com/library?sort=newest" -o /tmp/ollama-newest.html
 *   2. Parse: node .claude/scripts/parse-ollama-models.js
 *
 * Outputs: pipe-delimited format: modelName|pulls|capabilities|sizes|cloud
 * Example: deepseek-r1|66200000|tools,thinking|1.5b,7b,8b,14b,32b,70b,671b|
 * Example: kimi-k3|39000|vision,tools,thinking||cloud
 *
 * Filtering rules:
 *   - Everything on the library index is emitted (it IS the model list of record)
 *   - Models with 'embedding' capability are excluded (not carried in ollama.models.ts)
 *   - Cloud-only models are NOT excluded: they are emitted with the 5th field set to 'cloud'
 *     (they have no size chips - that is expected, not a parse failure)
 *
 * Pull counts are rounded to significant figures for stable diffs:
 *   - >=10M: round to 100K (e.g., 109,123,456 -> 109,100,000)
 *   - >=1M:  round to 10K  (e.g., 5,432,100 -> 5,430,000)
 *   - <1M:   round to 1K   (e.g., 88,700 -> 89,000)
 *
 * Markup note: the page has no machine-readable attributes - the fields are read off the
 * rendered chips (indigo = capability, blue = size, cyan = cloud) and the "Pulls" label.
 * If a run reports 0 pulls / no capabilities for every model, the markup changed again:
 * re-derive the four regexes below from a fresh fetch.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const htmlPath = process.argv[2] || path.join(os.tmpdir(), 'ollama-newest.html');

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: HTML file not found at ${htmlPath}`);
  console.error('Please fetch it first with:');
  console.error('  curl -s "https://ollama.com/library?sort=newest" -o /tmp/ollama-newest.html');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Split into model sections - each starts with <a href="/library/
const modelSections = html.split(/<a href="\/library\//);
const allParsedModels = [];
let skippedEmbeddings = 0;

for (let i = 1; i < modelSections.length; i++) {
  const section = modelSections[i].substring(0, 5000); // Large enough window to capture all data

  // Extract model name (first quoted string)
  const nameMatch = section.match(/^([^"]+)"/);
  if (!nameMatch) continue;
  const name = nameMatch[1];

  // Extract pulls from the "<count></span><span ...>&nbsp;Pulls" pair
  const pullsMatch = section.match(/>([\d.,]+[KM]?)<\/span>\s*<span[^>]*>&nbsp;Pulls/);
  let pulls = 0;
  if (pullsMatch) {
    const pullStr = pullsMatch[1].replace(/,/g, '');
    if (pullStr.includes('M')) {
      pulls = Math.floor(parseFloat(pullStr) * 1000000);
    } else if (pullStr.includes('K')) {
      pulls = Math.floor(parseFloat(pullStr) * 1000);
    } else {
      pulls = parseInt(pullStr);
    }
  }

  // Extract capabilities from the indigo chips (tools, vision, thinking, embedding, audio)
  const capabilities = [];
  const capabilityRegex = /text-indigo-600[^"]*">([^<]+)</g;
  let capMatch;
  while ((capMatch = capabilityRegex.exec(section)) !== null) {
    capabilities.push(capMatch[1].trim());
  }

  // Extract the cloud marker from the cyan chip (cloud-only models have no sizes)
  const isCloud = /text-cyan-500[^"]*">\s*cloud\s*</.test(section);

  // Extract sizes from the blue chips (1.5b, 7b, etc.)
  const sizes = [];
  const sizeRegex = /text-blue-600[^"]*">([^<]+)</g;
  let sizeMatch;
  while ((sizeMatch = sizeRegex.exec(section)) !== null) {
    sizes.push(sizeMatch[1].trim());
  }

  // Skip models with 'embedding' capability
  if (capabilities.includes('embedding')) {
    skippedEmbeddings++;
    continue;
  }

  allParsedModels.push({ name, pulls: roundPulls(pulls), capabilities, sizes, isCloud });
}

const models = allParsedModels;

/**
 * Round pulls to significant figures for stable output.
 * This reduces churn from daily fluctuations while preserving magnitude.
 */
function roundPulls(pulls) {
  if (pulls >= 10000000) return Math.round(pulls / 100000) * 100000;  // >=10M: round to 100K
  if (pulls >= 1000000) return Math.round(pulls / 10000) * 10000;     // >=1M: round to 10K
  return Math.round(pulls / 1000) * 1000;                             // <1M: round to 1K
}

// Output in pipe-delimited format (in the order they appear on the page)
models.forEach(m => {
  const caps = m.capabilities.join(',');
  const tags = m.sizes.join(',');
  console.log(`${m.name}|${m.pulls}|${caps}|${tags}|${m.isCloud ? 'cloud' : ''}`);
});

const cloudCount = models.filter(m => m.isCloud).length;
const noPullsCount = models.filter(m => !m.pulls).length;
console.error(`\nTotal models: ${models.length} (${cloudCount} cloud-only, ${skippedEmbeddings} embedding models skipped)`);
if (noPullsCount === models.length)
  console.error('WARNING: 0 pulls on every model - the page markup changed, fix the regexes in this script');
else if (noPullsCount)
  console.error(`WARNING: ${noPullsCount} model(s) parsed with 0 pulls`);
