import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

// ─── config ──────────────────────────────────────────────────────────────────

export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

const MODEL_SIMPLE = () => process.env.OPENAI_MODEL_SIMPLE ?? 'gpt-4.1';
const MODEL_COMPLEX = () => process.env.OPENAI_MODEL_COMPLEX ?? 'gpt-4.1';

export function getModelForComplexity(complexity: 'SIMPLE' | 'COMPLEX'): string {
  return complexity === 'SIMPLE' ? MODEL_SIMPLE() : MODEL_COMPLEX();
}

/** Fallback model chain: primary → fallback → last resort → null (template plan) */
const FALLBACK_CHAIN: Record<string, string[]> = {
  'gpt-4.1': ['gpt-4o', 'gpt-4.1-mini'],
  'gpt-4.1-mini': ['gpt-4.1', 'gpt-4o'],
  'gpt-4o': ['gpt-4.1', 'gpt-4.1-mini'],
  'gpt-4o-mini': ['gpt-4.1-mini', 'gpt-4o'],
};

function getFallbackModels(primaryModel: string): string[] {
  return FALLBACK_CHAIN[primaryModel] ?? ['gpt-4o-mini'];
}

// ─── pricing (per 1M tokens) ────────────────────────────────────────────────

const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  'gpt-4o-mini': 16384,
  'gpt-4o': 16384,
  'gpt-4.1-mini': 16384,
  'gpt-4.1': 32768,
};

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini']!;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

// ─── client singleton ────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface CallOpenAiOptions {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: Record<string, unknown>;
}

export interface CallOpenAiResult {
  content: Record<string, unknown>;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

// ─── retryable error classification ─────────────────────────────────────────

class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503].includes(status);
}

// ─── strip markdown wrappers ────────────────────────────────────────────────

function stripMarkdownJson(text: string): string {
  // Remove ```json ... ``` wrappers
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1]!.trim();
  return text.trim();
}

// ─── core API call ──────────────────────────────────────────────────────────

async function callOpenAiSingle(opts: CallOpenAiOptions): Promise<CallOpenAiResult> {
  const client = getClient();

  const modelMax = MODEL_MAX_COMPLETION_TOKENS[opts.model] ?? 16384;
  const maxTokens = Math.min(opts.maxTokens ?? 16000, modelMax);
  const params: ChatCompletionCreateParamsNonStreaming = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.7,
  };
  // Use max_completion_tokens for newer models (required for Structured Outputs)
  // and max_tokens as fallback for older models
  if (opts.jsonSchema) {
    params.max_completion_tokens = maxTokens;
  } else {
    params.max_tokens = maxTokens;
  }

  // Use Structured Outputs if JSON schema provided
  if (opts.jsonSchema) {
    params.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'diet_plan',
        strict: true,
        schema: opts.jsonSchema,
      },
    } as ChatCompletionCreateParamsNonStreaming['response_format'];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await client.chat.completions.create(params, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const choice = response.choices[0];
    console.log(`[openai] Model ${response.model}, finish_reason=${choice?.finish_reason}, usage: ${response.usage?.prompt_tokens}/${response.usage?.completion_tokens}`);
    if (choice?.finish_reason === 'length') {
      console.warn(`[openai] Response truncated (finish_reason=length) for model ${opts.model}. Output may be incomplete.`);
      // Don't throw — structured outputs will still produce valid (but partial) JSON.
      // The caller (processAiResult) detects incomplete plans and triggers partial regen.
    }
    if (!choice?.message?.content) {
      throw new RetryableError('Empty response from OpenAI');
    }

    const rawText = choice.message.content;
    const jsonText = stripMarkdownJson(rawText);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new RetryableError(`Failed to parse JSON response: ${jsonText.slice(0, 200)}`);
    }

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;

    return {
      content: parsed,
      model: response.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: estimateCostUsd(opts.model, promptTokens, completionTokens),
    };
  } catch (err) {
    clearTimeout(timeout);

    if (err instanceof RetryableError || err instanceof FatalError) throw err;

    // AbortController timeout
    if (err instanceof Error && err.name === 'AbortError') {
      throw new RetryableError('OpenAI request timed out (180s)');
    }

    // OpenAI SDK errors
    if (err instanceof OpenAI.APIError) {
      console.error(`[openai] API error ${err.status} for model ${opts.model}: ${err.message}`);
      if (isRetryableStatus(err.status ?? 0)) {
        throw new RetryableError(`OpenAI API error ${err.status}: ${err.message}`);
      }
      throw new FatalError(`OpenAI API error ${err.status}: ${err.message}`);
    }

    throw new RetryableError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── public API with fallback chain ─────────────────────────────────────────

/**
 * Call OpenAI with automatic fallback to alternative models.
 * Returns null if all models fail (caller should use template fallback).
 */
export async function callOpenAI(opts: CallOpenAiOptions): Promise<CallOpenAiResult> {
  const models = [opts.model, ...getFallbackModels(opts.model)];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const result = await callOpenAiSingle({ ...opts, model });
      if (model !== opts.model) {
        console.warn(`[openai] Primary model ${opts.model} failed, succeeded with fallback ${model}`);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof FatalError) {
        console.error(`[openai] Fatal error with model ${model}: ${err.message}`);
        // Fatal errors might be model-specific (e.g. model not found) — try next
        continue;
      }

      console.warn(`[openai] Retryable error with model ${model}: ${lastError.message}. Trying next model...`);
    }
  }

  // All models exhausted — throw so BullMQ can retry
  throw lastError ?? new Error('All OpenAI models failed');
}
