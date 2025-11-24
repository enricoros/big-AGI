#!/usr/bin/env tsx
/**
 * LLM Registry Sync
 *
 * Monitors LLM vendors for model changes and sends notifications.
 * See README.md for full documentation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';
import type { ModelDescriptionSchema } from '~/modules/llms/server/llm.server.types';
import { listModelsRunDispatch } from '~/modules/llms/server/listModels.dispatch';

// ============================================================================
// Types & Constants
// ============================================================================

const DB_PATH = path.join(__dirname, 'llm-registry.db');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
} as const;

interface CliOptions {
  config?: string;
  dialect?: string;
  key?: string;
  host?: string;
  format: 'table' | 'json';
  verbose: boolean;
  posthogKey?: string;
  discordWebhook?: string;
  notifyFilters?: string;
  validate?: boolean;
}

interface StoredModel {
  id: string;
  vendor: string;
  service: string;
  label: string;
  first_seen: string;
  last_seen: string;
  deleted_at: string | null;
  created: number | null;
  updated: number | null;
  context_window: number | null;
  max_completion_tokens: number | null;
  interfaces: string | null;
  description: string | null;
  benchmark_elo: number | null;
  benchmark_mmlu: number | null;
  price_input: number | null;
  price_output: number | null;
  original_json: string;
}

interface ModelChanges {
  new: ModelDescriptionSchema[];
  updated: ModelDescriptionSchema[];
  deleted: ModelDescriptionSchema[];
  unchanged: ModelDescriptionSchema[];
}

interface SyncResult {
  success: boolean;
  count?: number;
  changes?: ModelChanges;
  error?: string;
}

// ============================================================================
// Database Layer
// ============================================================================

function extractSimplePrice(price: any): number | null {
  if (!price) return null;
  if (typeof price === 'number') return price;
  if (price === 'free') return 0;
  if (Array.isArray(price) && price.length > 0) return extractSimplePrice(price[0].price);
  return null;
}

function initDatabase(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
      CREATE TABLE IF NOT EXISTS models
      (
          id                    TEXT NOT NULL,
          vendor                TEXT NOT NULL,
          service               TEXT NOT NULL,
          label                 TEXT NOT NULL,
          first_seen            TEXT NOT NULL,
          last_seen             TEXT NOT NULL,
          deleted_at            TEXT,
          created               INTEGER,
          updated               INTEGER,
          context_window        INTEGER,
          max_completion_tokens INTEGER,
          interfaces            TEXT,
          description           TEXT,
          benchmark_elo         REAL,
          benchmark_mmlu        REAL,
          price_input           REAL,
          price_output          REAL,
          original_json         TEXT NOT NULL,
          PRIMARY KEY (id, vendor, service)
      )
  `);

  db.exec(`
      CREATE TABLE IF NOT EXISTS sync_history
      (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp      TEXT    NOT NULL,
          services       TEXT    NOT NULL,
          models_found   INTEGER NOT NULL,
          models_new     INTEGER NOT NULL,
          models_updated INTEGER NOT NULL,
          models_deleted INTEGER NOT NULL
      )
  `);

  return db;
}

function getExistingModels(
  db: DatabaseSync,
  vendor: string,
  service: string,
): Map<string, StoredModel> {
  const models = new Map<string, StoredModel>();
  const stmt = db.prepare('SELECT * FROM models WHERE vendor = ? AND service = ?');
  const rows = stmt.all(vendor, service) as unknown as StoredModel[];
  for (const row of rows) {
    models.set(row.id, row);
  }
  return models;
}

function saveChanges(
  db: DatabaseSync,
  vendor: string,
  service: string,
  changes: ModelChanges,
  timestamp: string,
): void {
  if (changes.new.length > 0) {
    const stmt = db.prepare(`
        INSERT INTO models (id, vendor, service, label, first_seen, last_seen, created, updated,
                            context_window, max_completion_tokens, interfaces, description,
                            benchmark_elo, benchmark_mmlu, price_input, price_output, original_json, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT (id, vendor, service) DO UPDATE SET
            label                 = excluded.label,
            last_seen             = excluded.last_seen,
            created               = excluded.created,
            updated               = excluded.updated,
            context_window        = excluded.context_window,
            max_completion_tokens = excluded.max_completion_tokens,
            interfaces            = excluded.interfaces,
            description           = excluded.description,
            benchmark_elo         = excluded.benchmark_elo,
            benchmark_mmlu        = excluded.benchmark_mmlu,
            price_input           = excluded.price_input,
            price_output          = excluded.price_output,
            original_json         = excluded.original_json,
            deleted_at            = NULL
    `);

    for (const model of changes.new) {
      stmt.run(
        model.id,
        vendor,
        service,
        model.label,
        timestamp,
        timestamp,
        model.created ?? null,
        model.updated ?? null,
        model.contextWindow ?? null,
        model.maxCompletionTokens ?? null,
        model.interfaces ? JSON.stringify(model.interfaces) : null,
        model.description ?? null,
        model.benchmark?.cbaElo ?? null,
        model.benchmark?.cbaMmlu ?? null,
        extractSimplePrice(model.chatPrice?.input),
        extractSimplePrice(model.chatPrice?.output),
        JSON.stringify(model),
      );
    }
  }

  if (changes.updated.length > 0) {
    const stmt = db.prepare(`
        UPDATE models
        SET label                 = ?,
            last_seen             = ?,
            created               = ?,
            updated               = ?,
            context_window        = ?,
            max_completion_tokens = ?,
            interfaces            = ?,
            description           = ?,
            benchmark_elo         = ?,
            benchmark_mmlu        = ?,
            price_input           = ?,
            price_output          = ?,
            original_json         = ?,
            deleted_at            = NULL
        WHERE id = ?
          AND vendor = ?
          AND service = ?
    `);

    for (const model of changes.updated) {
      stmt.run(
        model.label,
        timestamp,
        model.created ?? null,
        model.updated ?? null,
        model.contextWindow ?? null,
        model.maxCompletionTokens ?? null,
        model.interfaces ? JSON.stringify(model.interfaces) : null,
        model.description ?? null,
        model.benchmark?.cbaElo ?? null,
        model.benchmark?.cbaMmlu ?? null,
        extractSimplePrice(model.chatPrice?.input),
        extractSimplePrice(model.chatPrice?.output),
        JSON.stringify(model),
        model.id,
        vendor,
        service,
      );
    }
  }

  if (changes.unchanged.length > 0) {
    const stmt = db.prepare(`
        INSERT INTO models (id, vendor, service, label, first_seen, last_seen, created, updated,
                            context_window, max_completion_tokens, interfaces, description,
                            benchmark_elo, benchmark_mmlu, price_input, price_output, original_json, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT (id, vendor, service) DO UPDATE SET last_seen = excluded.last_seen
    `);

    for (const model of changes.unchanged) {
      stmt.run(
        model.id,
        vendor,
        service,
        model.label,
        timestamp,
        timestamp,
        model.created ?? null,
        model.updated ?? null,
        model.contextWindow ?? null,
        model.maxCompletionTokens ?? null,
        model.interfaces ? JSON.stringify(model.interfaces) : null,
        model.description ?? null,
        model.benchmark?.cbaElo ?? null,
        model.benchmark?.cbaMmlu ?? null,
        extractSimplePrice(model.chatPrice?.input),
        extractSimplePrice(model.chatPrice?.output),
        JSON.stringify(model),
      );
    }
  }

  // Mark deleted models
  if (changes.deleted.length > 0) {
    const stmt = db.prepare(
      'UPDATE models SET deleted_at = ? WHERE id = ? AND vendor = ? AND service = ? AND deleted_at IS NULL',
    );

    for (const model of changes.deleted) {
      stmt.run(timestamp, model.id, vendor, service);
    }
  }
}

function saveSyncHistory(
  db: DatabaseSync,
  timestamp: string,
  services: string[],
  stats: { found: number; new: number; updated: number; deleted: number },
): void {
  const stmt = db.prepare(`
      INSERT INTO sync_history (timestamp, services, models_found, models_new, models_updated, models_deleted)
      VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    timestamp,
    services.join(','),
    stats.found,
    stats.new,
    stats.updated,
    stats.deleted,
  );
}

// ============================================================================
// Change Detection
// ============================================================================

function detectChanges(
  db: DatabaseSync,
  existing: Map<string, StoredModel>,
  current: ModelDescriptionSchema[],
): ModelChanges {
  const changes: ModelChanges = {
    new: [],
    updated: [],
    deleted: [],
    unchanged: [],
  };

  const currentIds = new Set<string>();

  for (const model of current) {
    if (!model.id) continue;
    if (model.idVariant) continue; // Skip synthetic UI variants

    currentIds.add(model.id);
    const existingModel = existing.get(model.id);

    if (!existingModel) {
      const globalCheckStmt = db.prepare('SELECT 1 FROM models WHERE id = ? LIMIT 1');
      const existsGlobally = globalCheckStmt.get(model.id);

      if (!existsGlobally) {
        changes.new.push(model);
      } else {
        changes.unchanged.push(model);
      }
    } else if (existingModel.deleted_at) {
      changes.updated.push(model);
    } else {
      const modelInterfaces = model.interfaces ? JSON.stringify(model.interfaces) : null;
      const hasChanged =
        existingModel.label !== model.label ||
        existingModel.context_window !== (model.contextWindow ?? null) ||
        existingModel.max_completion_tokens !== (model.maxCompletionTokens ?? null) ||
        existingModel.interfaces !== modelInterfaces;

      if (hasChanged) {
        changes.updated.push(model);
      } else {
        changes.unchanged.push(model);
      }
    }
  }

  for (const [id, storedModel] of Array.from(existing.entries())) {
    if (!currentIds.has(id) && !storedModel.deleted_at) {
      try {
        const model = JSON.parse(storedModel.original_json);
        changes.deleted.push(model);
      } catch (error) {
        console.error(`${COLORS.yellow}Warning: Corrupted JSON for ${id}${COLORS.reset}`);
      }
    }
  }

  return changes;
}

// ============================================================================
// Notification Layer
// ============================================================================

async function notifyPostHog(
  apiKey: string,
  eventName: string,
  properties: Record<string, any>,
): Promise<void> {
  try {
    const response = await fetch('https://app.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: eventName,
        distinct_id: 'llm-registry-sync',
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }
  } catch (error: any) {
    console.error(`${COLORS.yellow}PostHog error: ${error.message}${COLORS.reset}`);
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function printChanges(
  serviceName: string,
  models: ModelDescriptionSchema[],
  changes: ModelChanges,
  verbose: boolean,
): void {
  console.log(`\n${COLORS.bright}${COLORS.cyan}=== ${serviceName.toUpperCase()} ===${COLORS.reset}`);
  console.log(
    `${COLORS.dim}Total: ${models.length} | ` +
    `${COLORS.green}New: ${changes.new.length}${COLORS.reset} | ` +
    `${COLORS.yellow}Updated: ${changes.updated.length}${COLORS.reset} | ` +
    `${COLORS.red}Deleted: ${changes.deleted.length}${COLORS.reset} | ` +
    `${COLORS.dim}Unchanged: ${changes.unchanged.length}${COLORS.reset}\n`,
  );

  if (changes.new.length > 0) {
    console.log(`${COLORS.green}${COLORS.bright}NEW MODELS (${changes.new.length}):${COLORS.reset}`);
    for (const model of changes.new) {
      console.log(`  ${COLORS.green}+${COLORS.reset} ${COLORS.bright}${model.id}${COLORS.reset}`);
      console.log(`    ${COLORS.dim}Label:${COLORS.reset} ${model.label}`);
      if (verbose && model.contextWindow) {
        console.log(`    ${COLORS.dim}Context:${COLORS.reset} ${model.contextWindow} tokens`);
      }
    }
    console.log();
  }

  if (changes.updated.length > 0) {
    console.log(`${COLORS.yellow}${COLORS.bright}UPDATED MODELS (${changes.updated.length}):${COLORS.reset}`);
    for (const model of changes.updated) {
      console.log(`  ${COLORS.yellow}~${COLORS.reset} ${COLORS.bright}${model.id}${COLORS.reset}`);
      console.log(`    ${COLORS.dim}Label:${COLORS.reset} ${model.label}`);
    }
    console.log();
  }

  if (changes.deleted.length > 0) {
    console.log(`${COLORS.red}${COLORS.bright}DELETED MODELS (${changes.deleted.length}):${COLORS.reset}`);
    for (const model of changes.deleted) {
      console.log(`  ${COLORS.red}-${COLORS.reset} ${COLORS.dim}${model.id}${COLORS.reset}`);
    }
    console.log();
  }
}

function printSummary(
  results: Record<string, SyncResult>,
  stats: { found: number; new: number; updated: number; deleted: number },
): void {
  console.log(`\n${COLORS.bright}${COLORS.cyan}=== SYNC SUMMARY ===${COLORS.reset}`);

  const successCount = Object.values(results).filter((r) => r.success).length;
  const totalCount = Object.keys(results).length;

  console.log(`${COLORS.green}${successCount}/${totalCount}${COLORS.reset} services synced successfully`);
  console.log(`${COLORS.dim}Total models:${COLORS.reset} ${stats.found}`);
  console.log(
    `${COLORS.green}New:${COLORS.reset} ${stats.new} | ` +
    `${COLORS.yellow}Updated:${COLORS.reset} ${stats.updated} | ` +
    `${COLORS.red}Deleted:${COLORS.reset} ${stats.deleted}`,
  );
  console.log(`${COLORS.dim}Database:${COLORS.reset} ${DB_PATH}`);
}

// ============================================================================
// Configuration
// ============================================================================

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    format: 'table',
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    const nextArg = args[i + 1];

    switch (arg) {
      case '--config':
      case '-c':
        options.config = nextArg;
        i++;
        break;
      case '--dialect':
      case '-d':
        options.dialect = nextArg;
        i++;
        break;
      case '--key':
      case '-k':
        options.key = nextArg;
        i++;
        break;
      case '--host':
      case '-h':
        options.host = nextArg;
        i++;
        break;
      case '--format':
      case '-f':
        options.format = nextArg as 'table' | 'json';
        i++;
        break;
      case '--posthog-key':
        options.posthogKey = nextArg;
        i++;
        break;
      case '--discord-webhook':
        options.discordWebhook = nextArg;
        i++;
        break;
      case '--notify-filters':
        options.notifyFilters = nextArg;
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--validate':
        options.validate = true;
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
${COLORS.bright}Big-AGI LLM Registry Sync${COLORS.reset}

${COLORS.bright}Usage:${COLORS.reset}
  llm-registry-sync.sh [options]

${COLORS.bright}Options:${COLORS.reset}
  -c, --config <file>         Path to services configuration JSON
  -d, --dialect <name>        Single dialect mode
  -k, --key <key>             API key for single dialect mode
  -h, --host <url>            API host override
  -f, --format <type>         Output format: table (default), json
  -v, --verbose               Verbose output
  --validate                  Validate config and test API connectivity
  --posthog-key <key>         PostHog API key for analytics
  --discord-webhook <url>     Discord webhook URL
  --notify-filters <list>     Comma-separated vendor list (e.g., openai,anthropic)
  --help                      Show this help

${COLORS.bright}Examples:${COLORS.reset}
  # Validate configuration
  llm-registry-sync.sh --config ./services.json --validate

  # Basic usage
  llm-registry-sync.sh --config ./services.json

  # With notifications
  llm-registry-sync.sh --config ./services.json \\
    --posthog-key phc_... \\
    --discord-webhook https://discord.com/api/webhooks/...

  # Single vendor
  llm-registry-sync.sh --dialect openai --key sk-...
`);
}

function loadConfig(configPath: string): Record<string, AixAPI_Access> {
  const fullPath = path.resolve(configPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Configuration file not found: ${fullPath}`);
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content);

    const filtered: Record<string, AixAPI_Access> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'object' && value !== null && 'dialect' in value) {
        filtered[key] = value as AixAPI_Access;
      }
    }

    return filtered;
  } catch (error: any) {
    throw new Error(`Failed to parse configuration: ${error.message}`);
  }
}

function isPlaceholderKey(key: string): boolean {
  if (!key || key.trim() === '') return true;
  if (key.includes('YOUR_') || key.includes('API_KEY_HERE')) return true;
  if (key === 'sk-...' || key === 'sk-ant-...' || key === 'gsk_...') return true;
  return false;
}

async function validateConfig(config: Record<string, AixAPI_Access>): Promise<void> {
  console.log(`\n${COLORS.bright}${COLORS.cyan}=== CONFIG VALIDATION ===${COLORS.reset}\n`);

  let validCount = 0;
  let invalidCount = 0;
  let skippedCount = 0;

  for (const [serviceName, access] of Object.entries(config)) {
    process.stdout.write(`${COLORS.dim}Testing ${serviceName}...${COLORS.reset} `);

    const keyField = 'oaiKey' in access ? access.oaiKey :
                     'anthropicKey' in access ? access.anthropicKey :
                     'geminiKey' in access ? access.geminiKey : null;

    if (keyField && isPlaceholderKey(keyField)) {
      console.log(`${COLORS.yellow}SKIPPED${COLORS.reset} (placeholder key)`);
      skippedCount++;
      continue;
    }

    try {
      const models = await listModelsRunDispatch(access);
      if (models && models.length > 0) {
        console.log(`${COLORS.green}✓ OK${COLORS.reset} (${models.length} models)`);
        validCount++;
      } else {
        console.log(`${COLORS.yellow}⚠ WARNING${COLORS.reset} (0 models returned)`);
        invalidCount++;
      }
    } catch (error: any) {
      console.log(`${COLORS.red}✗ FAILED${COLORS.reset} (${error.message})`);
      invalidCount++;
    }
  }

  console.log(`\n${COLORS.bright}Summary:${COLORS.reset}`);
  console.log(`  ${COLORS.green}Valid:${COLORS.reset} ${validCount}`);
  console.log(`  ${COLORS.red}Invalid:${COLORS.reset} ${invalidCount}`);
  console.log(`  ${COLORS.yellow}Skipped:${COLORS.reset} ${skippedCount}`);
  console.log(`  ${COLORS.dim}Total:${COLORS.reset} ${Object.keys(config).length}\n`);

  if (invalidCount > 0) {
    process.exit(1);
  }
}

function createSingleConfig(
  dialect: string,
  key: string,
  host?: string,
): Record<string, AixAPI_Access> {
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
      } as any;
      break;

    default:
      throw new Error(`Unsupported dialect: ${dialect}`);
  }

  return config;
}

// ============================================================================
// Main Sync Logic
// ============================================================================

async function syncService(
  db: DatabaseSync,
  serviceName: string,
  access: AixAPI_Access,
  options: CliOptions,
  timestamp: string,
): Promise<SyncResult> {
  try {
    if (options.verbose) {
      console.log(`${COLORS.dim}Syncing ${serviceName}...${COLORS.reset}`);
    }

    // Fetch current models
    const models = await listModelsRunDispatch(access);
    const vendor = access.dialect;

    // Get existing models
    const existing = getExistingModels(db, vendor, serviceName);

    // Detect changes
    const changes = detectChanges(db, existing, models);

    // Save to database
    saveChanges(db, vendor, serviceName, changes, timestamp);

    // Print output
    if (options.format === 'table') {
      printChanges(serviceName, models, changes, options.verbose);
    }

    return {
      success: true,
      count: models.length,
      changes,
    };
  } catch (error: any) {
    if (options.format === 'table') {
      console.log(`\n${COLORS.bright}${COLORS.red}=== ${serviceName.toUpperCase()} ===${COLORS.reset}`);
      console.log(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

async function runSync(
  db: DatabaseSync,
  servicesConfig: Record<string, AixAPI_Access>,
  options: CliOptions,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const results: Record<string, SyncResult> = {};
  const stats = { found: 0, new: 0, updated: 0, deleted: 0 };

  // Track globally unique changes across all services
  const globalNewModels = new Map<string, { model: ModelDescriptionSchema; vendor: string; service: string }>();
  const globalUpdatedModels = new Map<string, { model: ModelDescriptionSchema; vendor: string; service: string }>();
  const globalDeletedModels = new Map<string, { model: ModelDescriptionSchema; vendor: string; service: string }>();

  // Sync all services
  for (const [serviceName, access] of Object.entries(servicesConfig)) {
    const result = await syncService(db, serviceName, access, options, timestamp);
    results[serviceName] = result;

    if (result.success && result.changes) {
      stats.found += result.count ?? 0;
      stats.new += result.changes.new.length;
      stats.updated += result.changes.updated.length;
      stats.deleted += result.changes.deleted.length;

      // Collect unique global changes (by model.id)
      for (const model of result.changes.new) {
        if (!globalNewModels.has(model.id)) {
          globalNewModels.set(model.id, { model, vendor: access.dialect, service: serviceName });
        }
      }
      for (const model of result.changes.updated) {
        if (!globalUpdatedModels.has(model.id)) {
          globalUpdatedModels.set(model.id, { model, vendor: access.dialect, service: serviceName });
        }
      }
      for (const model of result.changes.deleted) {
        if (!globalDeletedModels.has(model.id)) {
          globalDeletedModels.set(model.id, { model, vendor: access.dialect, service: serviceName });
        }
      }
    }
  }

  // Save history
  saveSyncHistory(db, timestamp, Object.keys(servicesConfig), stats);

  if (globalNewModels.size > 0 || globalUpdatedModels.size > 0 || globalDeletedModels.size > 0) {
    if (options.posthogKey) {
      if (globalNewModels.size > 0) {
        await notifyPostHog(options.posthogKey, 'llm_models_new', {
          count: globalNewModels.size,
          models: Array.from(globalNewModels.values()).map(({ model, vendor, service }) => ({
            id: model.id,
            label: model.label,
            vendor,
            service,
            created: model.created,
            updated: model.updated,
            context_window: model.contextWindow,
            max_tokens: model.maxCompletionTokens,
            interfaces: model.interfaces,
            benchmark_elo: model.benchmark?.cbaElo,
            benchmark_mmlu: model.benchmark?.cbaMmlu,
            price_input: extractSimplePrice(model.chatPrice?.input),
            price_output: extractSimplePrice(model.chatPrice?.output),
          })),
        });
      }
      if (globalUpdatedModels.size > 0) {
        await notifyPostHog(options.posthogKey, 'llm_models_updated', {
          count: globalUpdatedModels.size,
          models: Array.from(globalUpdatedModels.values()).map(({ model, vendor, service }) => ({
            id: model.id,
            label: model.label,
            vendor,
            service,
            updated: model.updated,
            context_window: model.contextWindow,
            max_tokens: model.maxCompletionTokens,
            interfaces: model.interfaces,
          })),
        });
      }
      if (globalDeletedModels.size > 0) {
        await notifyPostHog(options.posthogKey, 'llm_models_deleted', {
          count: globalDeletedModels.size,
          models: Array.from(globalDeletedModels.values()).map(({ model, vendor, service }) => ({
            id: model.id,
            label: model.label,
            vendor,
            service,
          })),
        });
      }
    }

    // Discord (aggregate all changes into one message)
    if (options.discordWebhook) {
      const embeds = [];

      if (globalNewModels.size > 0) {
        const modelList = Array.from(globalNewModels.values())
          .slice(0, 10)
          .map(({ model, vendor, service }) => `• \`${model.id}\` - ${model.label} (${vendor}/${service})`)
          .join('\n');
        const more = globalNewModels.size > 10 ? `\n...and ${globalNewModels.size - 10} more` : '';

        embeds.push({
          title: `🆕 New Models Detected`,
          description: modelList + more,
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
        });
      }

      if (globalUpdatedModels.size > 0) {
        const modelList = Array.from(globalUpdatedModels.values())
          .slice(0, 10)
          .map(({ model, vendor, service }) => `• \`${model.id}\` - ${model.label} (${vendor}/${service})`)
          .join('\n');
        const more = globalUpdatedModels.size > 10 ? `\n...and ${globalUpdatedModels.size - 10} more` : '';

        embeds.push({
          title: `📝 Updated Models`,
          description: modelList + more,
          color: 0xffaa00,
          timestamp: new Date().toISOString(),
        });
      }

      if (globalDeletedModels.size > 0) {
        const modelList = Array.from(globalDeletedModels.values())
          .slice(0, 10)
          .map(({ model, vendor, service }) => `• \`${model.id}\` (${vendor}/${service})`)
          .join('\n');
        const more = globalDeletedModels.size > 10 ? `\n...and ${globalDeletedModels.size - 10} more` : '';

        embeds.push({
          title: `🗑️ Deleted Models`,
          description: modelList + more,
          color: 0xff0000,
          timestamp: new Date().toISOString(),
        });
      }

      if (embeds.length > 0) {
        try {
          const response = await fetch(options.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds,
              username: 'LLM Registry Sync',
            }),
          });

          if (!response.ok) {
            throw new Error(response.statusText);
          }
        } catch (error: any) {
          console.error(`${COLORS.yellow}Discord error: ${error.message}${COLORS.reset}`);
        }
      }
    }
  }

  // Print summary
  if (options.format === 'table') {
    printSummary(results, stats);
  } else if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  }
}

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  try {
    const options = parseArgs();

    let servicesConfig: Record<string, AixAPI_Access>;

    if (options.config) {
      servicesConfig = loadConfig(options.config);
    } else if (options.dialect && options.key) {
      servicesConfig = createSingleConfig(options.dialect, options.key, options.host);
    } else {
      console.error(`${COLORS.red}Error: Either --config or (--dialect and --key) required${COLORS.reset}`);
      console.log('Run with --help for usage information');
      process.exit(1);
    }

    if (options.validate) {
      await validateConfig(servicesConfig);
      console.log(`${COLORS.green}✓ Configuration is valid!${COLORS.reset}`);
      process.exit(0);
    }

    const db = initDatabase();

    try {
      await runSync(db, servicesConfig, options);
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error(`${COLORS.red}Fatal error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  }
}

main();
