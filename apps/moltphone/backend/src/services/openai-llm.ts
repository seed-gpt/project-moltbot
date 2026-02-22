import OpenAI from 'openai';

export interface LLMSession {
    addUserMessage(text: string): void;
    addAssistantMessage(text: string): void;
    generateResponse(userText: string): AsyncGenerator<string, void, unknown>;
}

/**
 * Creates a new LLM session with conversation memory.
 * Streams response tokens for low-latency ConversationRelay integration.
 */
export function createLLMSession(systemPrompt: string, model?: string): LLMSession {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': process.env.APP_BASE_URL || 'https://moltphone.xyz',
            'X-Title': 'MoltPhone',
        }
    });

    // Default to gemini-2.5-flash for fastest response, unless overridden
    const selectedModel = model || 'google/gemini-2.5-flash';

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
    ];

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
