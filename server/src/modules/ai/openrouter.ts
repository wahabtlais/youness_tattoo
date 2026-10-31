import type { Config } from '../../config.ts';
import { AppError } from '../../lib/errors.ts';

/**
 * The model gateway (OpenRouter), behind one small interface - the rest of
 * the app never names a vendor or a model. Server-side only: the key is an
 * environment variable and never leaves the server. One retry on a rate
 * limit or a server error, a hard timeout, and errors that say what
 * happened without echoing anything the provider returned.
 */

export interface Completion {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AiClient {
  complete(req: { model: string; system: string; user: string; maxTokens: number }): Promise<Completion>;
}

export function openRouter(config: Config, fetchImpl: typeof fetch = fetch): AiClient {
  const key = config.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return {
    async complete({ model, system, user, maxTokens }) {
      for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
          res = await fetchImpl(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': config.PUBLIC_ORIGIN,
              'X-Title': 'Younes Tattoo Studio',
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              temperature: 0.3,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
              // ask for the actual cost, for the budget ledger
              usage: { include: true },
            }),
            signal: AbortSignal.timeout(config.AI_TIMEOUT_MS),
          });
        } catch (e) {
          const timeout = (e as Error).name === 'TimeoutError';
          throw new AppError(504, 'ai_timeout', timeout ? 'The assistant took too long to answer. Please try again.' : 'The assistant couldn’t be reached.');
        }
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (res.status === 401 || res.status === 403) throw new AppError(502, 'ai_auth', 'The assistant’s API key was refused. Check OPENROUTER_API_KEY.');
        if (res.status === 402) throw new AppError(502, 'ai_credits', 'The assistant’s account has no credit left.');
        if (res.status === 429) throw new AppError(429, 'ai_rate_limited', 'The assistant is busy right now. Please try again in a minute.');
        if (!res.ok) throw new AppError(502, 'ai_upstream', 'The assistant couldn’t answer just now.');
        const body = (await res.json()) as {
          model?: string;
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
        };
        const text = body.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new AppError(502, 'ai_empty', 'The assistant returned nothing usable.');
        return {
          text,
          model: body.model ?? model,
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
          costUsd: typeof body.usage?.cost === 'number' ? body.usage.cost : 0,
        };
      }
    },
  };
}
