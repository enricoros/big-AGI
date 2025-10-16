#!/usr/bin/env node
/**
 * Parse Ollama featured models from HTML
 *
 * Usage:
 *   1. Fetch HTML: curl -s "https://ollama.com/library?sort=featured" -o /tmp/ollama-featured.html
 *   2. Parse: node .claude/scripts/parse-ollama-models.js
 *
 * Outputs: pipe-delimited format: modelName|pulls|capabilities|sizes
 * Example: deepseek-r1|66200000|tools,thinking|1.5b,7b,8b,14b,32b,70b,671b
 */

const fs = require('fs');

const htmlPath = process.argv[2] || '/tmp/ollama-featured.html';

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: HTML file not found at ${htmlPath}`);
  console.error('Please fetch it first with:');
  console.error('  curl -s "https://ollama.com/library?sort=featured" -o /tmp/ollama-featured.html');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Split into model sections - each starts with <a href="/library/
const modelSections = html.split(/<a href="\/library\//);
const models = [];

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

  // Only include models with 50K+ pulls
  if (pulls >= 50000) {
    models.push({ name, pulls, capabilities, sizes });
  }
}

// Output in pipe-delimited format (in the order they appear on the page)
models.forEach(m => {
  const caps = m.capabilities.join(',');
  const tags = m.sizes.join(',');
  console.log(`${m.name}|${m.pulls}|${caps}|${tags}`);
});

console.error(`\nTotal models with 50K+ pulls: ${models.length}`);
