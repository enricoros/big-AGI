#!/usr/bin/env node
/**
 * Parse Ollama models from HTML (sorted by newest for stable ordering)
 *
 * Usage:
 *   1. Fetch HTML: curl -s "https://ollama.com/library?sort=newest" -o /tmp/ollama-newest.html
 *   2. Parse: node .claude/scripts/parse-ollama-models.js
 *
 * Outputs: pipe-delimited format: modelName|pulls|capabilities|sizes
 * Example: deepseek-r1|66200000|tools,thinking|1.5b,7b,8b,14b,32b,70b,671b
 *
 * Filtering rules:
 *   - Top 30 newest models are always included (regardless of pull count)
 *   - After top 30, only models with 50K+ pulls are included
 *   - Models with 'cloud' capability are always excluded
 *   - Models with 'embedding' capability are always excluded
 *
 * Pull counts are rounded to significant figures for stable diffs:
 *   - >=10M: round to 100K (e.g., 109,123,456 -> 109,100,000)
 *   - >=1M:  round to 10K  (e.g., 5,432,100 -> 5,430,000)
 *   - <1M:   round to 1K   (e.g., 88,700 -> 89,000)
 */

const fs = require('fs');

const htmlPath = process.argv[2] || '/tmp/ollama-newest.html';
const TOP_N_ALWAYS_INCLUDE = 30;
const MIN_PULLS_THRESHOLD = 50000;

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

for (let i = 1; i < modelSections.length; i++) {
  const section = modelSections[i].substring(0, 5000); // Large enough window to capture all data

  // Extract model name (first quoted string)
  const nameMatch = section.match(/^([^"]+)"/);
  if (!nameMatch) continue;
  const name = nameMatch[1];

  // Extract pulls using x-test-pull-count
  const pullsMatch = section.match(/x-test-pull-count>([^<]+)</);
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

  // Extract capabilities (tools, vision, embedding, thinking, cloud)
  const capabilities = [];
  const capabilityRegex = /x-test-capability[^>]*>([^<]+)</g;
  let capMatch;
  while ((capMatch = capabilityRegex.exec(section)) !== null) {
    capabilities.push(capMatch[1].trim());
  }

  // Extract sizes (1.5b, 7b, etc.)
  const sizes = [];
  const sizeRegex = /x-test-size[^>]*>([^<]+)</g;
  let sizeMatch;
  while ((sizeMatch = sizeRegex.exec(section)) !== null) {
    sizes.push(sizeMatch[1].trim());
  }

  // Skip models with 'cloud' or 'embedding' capability
  if (capabilities.includes('cloud') || capabilities.includes('embedding')) {
    continue;
  }

  allParsedModels.push({ name, pulls: roundPulls(pulls), capabilities, sizes });
}

// Apply filtering: top 30 always included, rest need 50K+ pulls
const models = allParsedModels.filter((model, index) => {
  return index < TOP_N_ALWAYS_INCLUDE || model.pulls >= MIN_PULLS_THRESHOLD;
});

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
  console.log(`${m.name}|${m.pulls}|${caps}|${tags}`);
});

const topNCount = Math.min(TOP_N_ALWAYS_INCLUDE, allParsedModels.length);
const thresholdCount = models.length - topNCount;
console.error(`\nTotal models: ${models.length} (top ${topNCount} newest + ${thresholdCount} with ${MIN_PULLS_THRESHOLD / 1000}K+ pulls)`);
