/**
 * Config Schema — full validation for cocapn.json.
 *
 * Covers: brain, llm, channels, generate, vision, research, plugins, glue.
 * Plain validation (no Zod). Helpful error messages. Defaults for missing fields.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LLMConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface VisionConfig {
  provider?: string;
  apiKey?: string;
  defaultModel?: string;
  defaultResolution?: string;
  spriteModel?: string;
  spriteResolution?: string;
}

export interface ResearchConfig {
  enabled?: boolean;
  schedule?: string;
  maxTopics?: number;
}

export interface GenerateConfig {
  provider?: string;
  apiKey?: string;
  defaultResolution?: string;
  maxParallel?: number;
  research?: ResearchConfig;
}

export interface ChannelConfig {
  telegram?: { token?: string; webhookUrl?: string };
  webhook?: { url?: string; secret?: string };
}

export interface PluginEntry {
  name: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface GlueConfig {
  peers?: Array<{ id: string; url: string; transport?: 'http' | 'ws' | 'stdio' }>;
  secret?: string;
}

export interface FullConfig {
  mode?: string;
  port?: number;
  llm?: LLMConfig;
  vision?: VisionConfig;
  generate?: GenerateConfig;
  channels?: ChannelConfig;
  plugins?: PluginEntry[];
  glue?: GlueConfig;
  brain?: { maxMessages?: number; archiveThreshold?: number };
  // Legacy flat fields (backward compat)
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ─── Validation result ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: string[];
}

// ─── Validators ────────────────────────────────────────────────────────────────

type Validator = (value: unknown, path: string) => string[];

const stringField = (field: string): Validator => (val, path) => {
  if (val !== undefined && typeof val !== 'string') return [`${path}.${field} must be a string`];
  return [];
};

const numberField = (field: string, min?: number, max?: number): Validator => (val, path) => {
  if (val === undefined) return [];
  if (typeof val !== 'number') return [`${path}.${field} must be a number`];
  if (min !== undefined && val < min) return [`${path}.${field} must be >= ${min}`];
  if (max !== undefined && val > max) return [`${path}.${field} must be <= ${max}`];
  return [];
};

const boolField = (field: string): Validator => (val, path) => {
  if (val !== undefined && typeof val !== 'boolean') return [`${path}.${field} must be a boolean`];
  return [];
};

function objectField(field: string, validators: Validator[]): Validator {
  return (val, path) => {
    if (val === undefined) return [];
    if (typeof val !== 'object' || val === null) return [`${path}.${field} must be an object`];
    const obj = (val as Record<string, unknown>)[field];
    if (obj === undefined) return [];
    if (typeof obj !== 'object' || obj === null) return [`${path}.${field} must be an object`];
    const errs: string[] = [];
    for (const v of validators) errs.push(...v(obj, `${path}.${field}`));
    return errs;
  };
}

// ─── Top-level validation ──────────────────────────────────────────────────────

function validateLLM(llm: unknown): string[] {
  if (llm === undefined) return [];
  if (typeof llm !== 'object' || llm === null) return ['llm must be an object'];
  const obj = llm as Record<string, unknown>;
  const path = 'llm';
  const errs: string[] = [];
  const validProviders = ['deepseek', 'openai', 'anthropic', 'ollama', 'google', 'openai-compatible'];

  errs.push(...stringField('provider')(obj.provider, path));
  errs.push(...stringField('apiKey')(obj.apiKey, path));
  errs.push(...stringField('baseUrl')(obj.baseUrl, path));
  errs.push(...stringField('model')(obj.model, path));
  errs.push(...numberField('temperature', 0, 2)(obj.temperature, path));
  errs.push(...numberField('maxTokens', 1)(obj.maxTokens, path));

  if (obj.provider !== undefined && typeof obj.provider === 'string' && !validProviders.includes(obj.provider)) {
    errs.push(`llm.provider "${obj.provider}" is not a recognized provider. Valid: ${validProviders.join(', ')}`);
  }
  return errs;
}

function validateVision(vision: unknown): string[] {
  if (vision === undefined) return [];
  if (typeof vision !== 'object' || vision === null) return ['vision must be an object'];
  const obj = vision as Record<string, unknown>;
  const path = 'vision';
  const errs: string[] = [];
  errs.push(...stringField('provider')(obj.provider, path));
  errs.push(...stringField('apiKey')(obj.apiKey, path));
  errs.push(...stringField('defaultModel')(obj.defaultModel, path));
  errs.push(...stringField('defaultResolution')(obj.defaultResolution, path));
  errs.push(...stringField('spriteModel')(obj.spriteModel, path));
  errs.push(...stringField('spriteResolution')(obj.spriteResolution, path));
  return errs;
}

function validateResearch(research: unknown, path: string): string[] {
  if (research === undefined) return [];
  if (typeof research !== 'object' || research === null) return [`${path} must be an object`];
  const obj = research as Record<string, unknown>;
  const errs: string[] = [];
  errs.push(...boolField('enabled')(obj.enabled, path));
  errs.push(...stringField('schedule')(obj.schedule, path));
  errs.push(...numberField('maxTopics', 1)(obj.maxTopics, path));
  return errs;
}

function validateGenerate(generate: unknown): string[] {
  if (generate === undefined) return [];
  if (typeof generate !== 'object' || generate === null) return ['generate must be an object'];
  const obj = generate as Record<string, unknown>;
  const path = 'generate';
  const errs: string[] = [];
  errs.push(...stringField('provider')(obj.provider, path));
  errs.push(...stringField('apiKey')(obj.apiKey, path));
  errs.push(...stringField('defaultResolution')(obj.defaultResolution, path));
  errs.push(...numberField('maxParallel', 1, 10)(obj.maxParallel, path));
  errs.push(...validateResearch(obj.research, `${path}.research`));
  return errs;
}

function validateChannels(channels: unknown): string[] {
  if (channels === undefined) return [];
  if (typeof channels !== 'object' || channels === null) return ['channels must be an object'];
  const obj = channels as Record<string, unknown>;
  const errs: string[] = [];

  if (obj.telegram !== undefined) {
    if (typeof obj.telegram !== 'object' || obj.telegram === null) {
      errs.push('channels.telegram must be an object');
    } else {
      const tg = obj.telegram as Record<string, unknown>;
      errs.push(...stringField('token')(tg.token, 'channels.telegram'));
      errs.push(...stringField('webhookUrl')(tg.webhookUrl, 'channels.telegram'));
    }
  }

  if (obj.webhook !== undefined) {
    if (typeof obj.webhook !== 'object' || obj.webhook === null) {
      errs.push('channels.webhook must be an object');
    } else {
      const wh = obj.webhook as Record<string, unknown>;
      errs.push(...stringField('url')(wh.url, 'channels.webhook'));
      errs.push(...stringField('secret')(wh.secret, 'channels.webhook'));
    }
  }
  return errs;
}

function validatePlugins(plugins: unknown): string[] {
  if (plugins === undefined) return [];
  if (!Array.isArray(plugins)) return ['plugins must be an array'];
  const errs: string[] = [];
  for (let i = 0; i < plugins.length; i++) {
    const p = plugins[i];
    if (typeof p !== 'object' || p === null) { errs.push(`plugins[${i}] must be an object`); continue; }
    const obj = p as Record<string, unknown>;
    if (typeof obj.name !== 'string' || !obj.name) errs.push(`plugins[${i}].name is required`);
    if (obj.enabled !== undefined && typeof obj.enabled !== 'boolean') errs.push(`plugins[${i}].enabled must be a boolean`);
  }
  return errs;
}

function validateGlue(glue: unknown): string[] {
  if (glue === undefined) return [];
  if (typeof glue !== 'object' || glue === null) return ['glue must be an object'];
  const obj = glue as Record<string, unknown>;
  const errs: string[] = [];
  errs.push(...stringField('secret')(obj.secret, 'glue'));

  if (obj.peers !== undefined) {
    if (!Array.isArray(obj.peers)) { errs.push('glue.peers must be an array'); return errs; }
    for (let i = 0; i < obj.peers.length; i++) {
      const peer = obj.peers[i];
      if (typeof peer !== 'object' || peer === null) { errs.push(`glue.peers[${i}] must be an object`); continue; }
      const p = peer as Record<string, unknown>;
      if (typeof p.id !== 'string' || !p.id) errs.push(`glue.peers[${i}].id is required`);
      if (typeof p.url !== 'string' || !p.url) errs.push(`glue.peers[${i}].url is required`);
      if (p.transport !== undefined && !['http', 'ws', 'stdio'].includes(p.transport as string)) {
        errs.push(`glue.peers[${i}].transport must be "http", "ws", or "stdio"`);
      }
    }
  }
  return errs;
}

function validateBrain(brain: unknown): string[] {
  if (brain === undefined) return [];
  if (typeof brain !== 'object' || brain === null) return ['brain must be an object'];
  const obj = brain as Record<string, unknown>;
  const errs: string[] = [];
  errs.push(...numberField('maxMessages', 10)(obj.maxMessages, 'brain'));
  errs.push(...numberField('archiveThreshold', 100)(obj.archiveThreshold, 'brain'));
  return errs;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function validateFullConfig(raw: Record<string, unknown>): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: string[] = [];

  // Top-level mode
  if (raw.mode !== undefined) {
    if (typeof raw.mode !== 'string' || !['private', 'public'].includes(raw.mode)) {
      errors.push({ path: 'mode', message: 'must be "private" or "public"' });
    }
  }

  // Top-level port
  if (raw.port !== undefined) {
    if (typeof raw.port !== 'number' || !Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) {
      errors.push({ path: 'port', message: 'must be an integer between 1 and 65535' });
    }
  }

  // Sections
  for (const err of validateLLM(raw.llm)) errors.push({ path: 'llm', message: err });
  for (const err of validateVision(raw.vision)) errors.push({ path: 'vision', message: err });
  for (const err of validateGenerate(raw.generate)) errors.push({ path: 'generate', message: err });
  for (const err of validateChannels(raw.channels)) errors.push({ path: 'channels', message: err });
  for (const err of validatePlugins(raw.plugins)) errors.push({ path: 'plugins', message: err });
  for (const err of validateGlue(raw.glue)) errors.push({ path: 'glue', message: err });
  for (const err of validateBrain(raw.brain)) errors.push({ path: 'brain', message: err });

  // Warnings
  const channels = raw.channels as Record<string, unknown> | undefined;
  const glue = raw.glue as Record<string, unknown> | undefined;
  const gluePeers = glue?.peers as unknown[] | undefined;
  if (!raw.llm && !raw.apiKey) warnings.push('No LLM config found — agent will need an API key or Ollama at runtime');
  if (channels?.telegram && !raw.llm) warnings.push('Telegram channel configured but no LLM specified');
  if (gluePeers?.length && !glue?.secret) warnings.push('Glue peers configured without a shared secret — connections may fail');

  return { valid: errors.length === 0, errors, warnings };
}

export function applyFullDefaults(config: FullConfig): Required<Pick<FullConfig, 'mode' | 'port'>> & FullConfig {
  return {
    ...config,
    mode: config.mode ?? 'private',
    port: config.port ?? 3100,
    llm: {
      provider: config.llm?.provider ?? 'deepseek',
      ...config.llm,
    },
    brain: {
      maxMessages: config.brain?.maxMessages ?? 100,
      archiveThreshold: config.brain?.archiveThreshold ?? 500,
      ...config.brain,
    },
    generate: {
      maxParallel: config.generate?.maxParallel ?? 3,
      ...config.generate,
      research: {
        enabled: config.generate?.research?.enabled ?? false,
        schedule: config.generate?.research?.schedule ?? '0 */6 * * *',
        maxTopics: config.generate?.research?.maxTopics ?? 10,
        ...config.generate?.research,
      },
    },
  };
}

/** Format validation errors into a human-readable string */
export function formatErrors(result: ValidationResult): string {
  const lines: string[] = [];
  if (result.errors.length > 0) {
    lines.push('Config validation errors:');
    for (const e of result.errors) lines.push(`  ✗ ${e.path}: ${e.message}`);
  }
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of result.warnings) lines.push(`  ⚠ ${w}`);
  }
  return lines.join('\n');
}
