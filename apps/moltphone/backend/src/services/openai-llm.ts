import OpenAI from 'openai';
import { getLogger } from '../middleware/logger.js';

export interface LLMSession {
    addUserMessage(text: string): void;
    addAssistantMessage(text: string): void;
    generateResponse(userText: string): AsyncGenerator<string, void, unknown>;
}

/** Map frontend model identifiers to OpenRouter model IDs */
const MODEL_MAP: Record<string, string> = {
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4.1': 'openai/gpt-4.1',
    'gpt-5.1': 'openai/gpt-5.1',
    'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    'claude-sonnet-4.5': 'anthropic/claude-sonnet-4.5',
};

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

/** Resolve a frontend model name to an OpenRouter model ID */
export function resolveModel(raw?: string): string {
    if (!raw) return DEFAULT_MODEL;
    if (MODEL_MAP[raw]) return MODEL_MAP[raw];
    // If already a qualified OpenRouter ID (contains '/'), pass through
    if (raw.includes('/')) return raw;
    return DEFAULT_MODEL;
}

/**
 * Creates a new LLM session with conversation memory.
 * Streams response tokens for low-latency ConversationRelay integration.
 * Uses OpenRouter API (OpenAI-compatible) for model access.
 */
export function createLLMSession(systemPrompt: string, model?: string): LLMSession {
    const log = getLogger('openai-llm');
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
    });
    const selectedModel = resolveModel(model);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
    ];

    log.info('LLM session created', { model: selectedModel, requestedModel: model });

    return {
        addUserMessage(text: string) {
            messages.push({ role: 'user', content: text });
        },

        addAssistantMessage(text: string) {
            messages.push({ role: 'assistant', content: text });
        },

        async *generateResponse(userText: string): AsyncGenerator<string, void, unknown> {
            messages.push({ role: 'user', content: userText });

            const stream = await openai.chat.completions.create({
                model: selectedModel,
                messages,
                stream: true,
                max_tokens: 300,
                temperature: 0.7,
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta?.content;
                if (token) {
                    fullResponse += token;
                    yield token;
                }
            }

            // Store full assistant response for conversation memory
            messages.push({ role: 'assistant', content: fullResponse });
        },
    };
}
