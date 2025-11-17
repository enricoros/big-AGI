#!/usr/bin/env tsx
/**
 * LLM Registry Sync Script
 *
 * Synchronizes LLM model information from configured vendors to an external registry.
 * Enumerates models, tracks changes, and maintains historical metadata.
 * Calls listModels dispatcher functions directly, without going through tRPC.
 *
 * Usage:
 *   scripts/llm-registry-sync.sh --config ./my-services.json
 *   scripts/llm-registry-sync.sh --dialect openai --key sk-...
 *
 * Configuration file format (JSON):
 * {
 *   "openai": {
 *     "dialect": "openai",
 *     "oaiKey": "sk-...",
 *     "oaiOrg": "",
 *     "oaiHost": "",
 *     "heliKey": "",
 *     "moderationCheck": false
 *   },
 *   "anthropic": {
 *     "dialect": "anthropic",
 *     "anthropicKey": "sk-ant-...",
 *     "anthropicHost": null,
 *     "heliconeKey": null
 *   }
 * }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';
import { listModelsRunDispatch } from '~/modules/llms/server/listModels.dispatch';


// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

interface CliOptions {
  config?: string;
  dialect?: string;
  key?: string;
  host?: string;
  outputFormat?: 'table' | 'json' | 'csv';
  verbose?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    outputFormat: 'table',
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--dialect':
      case '-d':
        options.dialect = args[++i];
        break;
      case '--key':
      case '-k':
        options.key = args[++i];
        break;
      case '--host':
      case '-h':
        options.host = args[++i];
        break;
      case '--format':
      case '-f':
        options.outputFormat = args[++i] as 'table' | 'json' | 'csv';
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${colors.bright}Big-AGI LLM Registry Sync${colors.reset}

${colors.bright}Usage:${colors.reset}
  scripts/llm-registry-sync.sh [options]

${colors.bright}Options:${colors.reset}
  -c, --config <file>      Path to JSON configuration file with service configs
  -d, --dialect <dialect>  Single dialect to enumerate (openai, anthropic, etc.)
  -k, --key <key>          API key for single dialect mode
  -h, --host <host>        API host for single dialect mode (optional)
  -f, --format <format>    Output format: table (default), json, csv
  -v, --verbose            Verbose output with additional details
  --help                   Show this help message

${colors.bright}Examples:${colors.reset}
  # Using a configuration file
  scripts/llm-registry-sync.sh --config ./services.json

  # Single dialect mode
  scripts/llm-registry-sync.sh --dialect openai --key sk-...

  # JSON output
  scripts/llm-registry-sync.sh --config ./services.json --format json

${colors.bright}Configuration File Format:${colors.reset}
  {
    "openai": {
      "dialect": "openai",
      "oaiKey": "sk-...",
      "oaiOrg": "",
      "oaiHost": "",
      "heliKey": "",
      "moderationCheck": false
    },
    "anthropic": {
      "dialect": "anthropic",
      "anthropicKey": "sk-ant-...",
      "anthropicHost": null,
      "heliconeKey": null
    }
  }
`);
}

function loadConfig(configPath: string): Record<string, AixAPI_Access> {
  const fullPath = path.resolve(configPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`${colors.red}Error: Configuration file not found: ${fullPath}${colors.reset}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error: Failed to parse configuration file: ${error}${colors.reset}`);
    process.exit(1);
  }
}

function createSingleDialectConfig(dialect: string, key: string, host?: string): Record<string, AixAPI_Access> {
  // Create a basic configuration for the given dialect
  const config: Record<string, AixAPI_Access> = {};

  switch (dialect) {
    case 'openai':
    case 'alibaba':
    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'moonshot':
    case 'openpipe':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
    case 'xai':
      config[dialect] = {
        dialect: dialect as any,
        oaiKey: key,
        oaiOrg: '',
        oaiHost: host || '',
        heliKey: '',
        moderationCheck: false,
      } as any;
      break;

    case 'anthropic':
      config[dialect] = {
        dialect: 'anthropic',
        anthropicKey: key,
        anthropicHost: host || null,
        heliconeKey: null,
      } as any;
      break;

    case 'gemini':
      config[dialect] = {
        dialect: 'gemini',
        geminiKey: key,
        geminiHost: host || '',
        minSafetyLevel: 'BLOCK_NONE',
      } as any;
      break;

    case 'ollama':
      config[dialect] = {
        dialect: 'ollama',
        ollamaHost: host || 'http://127.0.0.1:11434',
        ollamaJson: false,
      } as any;
      break;

    default:
      console.error(`${colors.red}Error: Unsupported dialect: ${dialect}${colors.reset}`);
      process.exit(1);
  }

  return config;
}

function formatTable(serviceName: string, models: any[], verbose: boolean) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${serviceName.toUpperCase()} ===${colors.reset}`);
  console.log(`${colors.dim}Found ${models.length} models${colors.reset}\n`);

  if (models.length === 0) {
    console.log(`${colors.yellow}No models found${colors.reset}`);
    return;
  }

  // Print models
  models.forEach((model, idx) => {
    const number = `${idx + 1}.`.padEnd(4);
    console.log(`${colors.dim}${number}${colors.reset}${colors.bright}${model.id}${colors.reset}`);
    console.log(`    ${colors.dim}Label:${colors.reset} ${model.label}`);

    if (verbose) {
      if (model.description) {
        const desc = model.description.split('\n')[0]; // First line only
        console.log(`    ${colors.dim}Description:${colors.reset} ${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}`);
      }
      if (model.contextWindow) {
        console.log(`    ${colors.dim}Context:${colors.reset} ${model.contextWindow} tokens`);
      }
      if (model.maxCompletionTokens) {
        console.log(`    ${colors.dim}Max Output:${colors.reset} ${model.maxCompletionTokens} tokens`);
      }
      if (model.interfaces && model.interfaces.length > 0) {
        console.log(`    ${colors.dim}Interfaces:${colors.reset} ${model.interfaces.join(', ')}`);
      }
    }
  });
}

function formatJson(results: Record<string, any>) {
  console.log(JSON.stringify(results, null, 2));
}

function formatCsv(results: Record<string, any>) {
  // CSV header
  console.log('Service,Model ID,Label,Context Window,Max Completion Tokens,Interfaces');

  // CSV rows
  for (const [serviceName, data] of Object.entries(results)) {
    if (data.error) continue;

    for (const model of data.models) {
      const row = [
        serviceName,
        model.id,
        `"${model.label}"`,
        model.contextWindow || '',
        model.maxCompletionTokens || '',
        `"${(model.interfaces || []).join(', ')}"`,
      ];
      console.log(row.join(','));
    }
  }
}

async function enumerateModels(servicesConfig: Record<string, AixAPI_Access>, options: CliOptions) {
  const results: Record<string, any> = {};

  for (const [serviceName, access] of Object.entries(servicesConfig)) {
    if (options.verbose) {
      console.log(`${colors.dim}Enumerating ${serviceName}...${colors.reset}`);
    }

    try {
      const models = await listModelsRunDispatch(access /*, signal*/);

      results[serviceName] = {
        success: true,
        count: models.length,
        models,
      };

      if (options.outputFormat === 'table') {
        formatTable(serviceName, models, options.verbose || false);
      }
    } catch (error: any) {
      results[serviceName] = {
        success: false,
        error: error.message || error.toString(),
      };

      if (options.outputFormat === 'table') {
        console.log(`\n${colors.bright}${colors.red}=== ${serviceName.toUpperCase()} ===${colors.reset}`);
        console.log(`${colors.red}Error: ${error.message || error.toString()}${colors.reset}`);
      }
    }
  }

  // Output in JSON or CSV format if requested
  if (options.outputFormat === 'json') {
    formatJson(results);
  } else if (options.outputFormat === 'csv') {
    formatCsv(results);
  } else if (options.outputFormat === 'table') {
    // Print summary
    console.log(`\n${colors.bright}${colors.cyan}=== SUMMARY ===${colors.reset}`);
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    const totalModels = Object.values(results)
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.count, 0);

    console.log(`${colors.green}${successCount}/${totalCount}${colors.reset} services enumerated successfully`);
    console.log(`${colors.green}${totalModels}${colors.reset} total models found`);
  }

  return results;
}

async function main() {
  const options = parseArgs();

  // Load configuration
  let servicesConfig: Record<string, AixAPI_Access>;

  if (options.config) {
    servicesConfig = loadConfig(options.config);
  } else if (options.dialect && options.key) {
    servicesConfig = createSingleDialectConfig(options.dialect, options.key, options.host);
  } else {
    console.error(`${colors.red}Error: Either --config or (--dialect and --key) must be provided${colors.reset}`);
    console.log('Run with --help for usage information');
    process.exit(1);
  }

  // Enumerate models
  await enumerateModels(servicesConfig, options);
}

// Run the script
main().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});
