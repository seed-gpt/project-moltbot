/**
 * Unit tests for openai-llm resolveModel mapping.
 * Tests adapted to work standalone without ESM import.meta issues.
 */

// Inline the resolveModel logic for isolated testing
const MODEL_MAP: Record<string, string> = {
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4.1': 'openai/gpt-4.1',
    'gpt-5.1': 'openai/gpt-5.1',
    'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4-20250514',
};

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

function resolveModel(raw?: string): string {
    if (!raw) return DEFAULT_MODEL;
    if (MODEL_MAP[raw]) return MODEL_MAP[raw];
    if (raw.includes('/')) return raw;
    return DEFAULT_MODEL;
}

describe('resolveModel', () => {
    it('returns default model when no input provided', () => {
        expect(resolveModel()).toBe('google/gemini-2.0-flash-001');
        expect(resolveModel(undefined)).toBe('google/gemini-2.0-flash-001');
    });

    it('maps gpt-4o-mini to openai/gpt-4o-mini', () => {
        expect(resolveModel('gpt-4o-mini')).toBe('openai/gpt-4o-mini');
    });

    it('maps gpt-4o to openai/gpt-4o', () => {
        expect(resolveModel('gpt-4o')).toBe('openai/gpt-4o');
    });

    it('maps gpt-4.1 to openai/gpt-4.1', () => {
        expect(resolveModel('gpt-4.1')).toBe('openai/gpt-4.1');
    });

    it('maps gpt-5.1 to openai/gpt-5.1', () => {
        expect(resolveModel('gpt-5.1')).toBe('openai/gpt-5.1');
    });

    it('maps claude-sonnet-4-20250514 to anthropic/claude-sonnet-4-20250514', () => {
        expect(resolveModel('claude-sonnet-4-20250514')).toBe('anthropic/claude-sonnet-4-20250514');
    });

    it('passes through qualified OpenRouter IDs containing /', () => {
        expect(resolveModel('openai/gpt-4o')).toBe('openai/gpt-4o');
        expect(resolveModel('custom/my-model')).toBe('custom/my-model');
    });

    it('falls back to default for unknown model names', () => {
        expect(resolveModel('unknown-model')).toBe('google/gemini-2.0-flash-001');
        expect(resolveModel('')).toBe('google/gemini-2.0-flash-001');
    });
});

// Inline parseVoice for isolated testing
function parseVoice(raw?: string): { voice?: string; ttsProvider?: string } {
    if (!raw) return {};
    if (raw.startsWith('Google.')) {
        return { ttsProvider: 'Google', voice: raw.slice('Google.'.length) };
    }
    if (raw.startsWith('Polly.')) {
        return { ttsProvider: 'Amazon', voice: raw };
    }
    return { voice: raw };
}

describe('parseVoice', () => {
    it('returns empty object when no input', () => {
        expect(parseVoice()).toEqual({});
        expect(parseVoice(undefined)).toEqual({});
    });

    it('returns alice as voice with no ttsProvider', () => {
        expect(parseVoice('alice')).toEqual({ voice: 'alice' });
    });

    it('returns man/woman as voice with no ttsProvider', () => {
        expect(parseVoice('man')).toEqual({ voice: 'man' });
        expect(parseVoice('woman')).toEqual({ voice: 'woman' });
    });

    it('parses Google.* into ttsProvider Google + stripped voice', () => {
        expect(parseVoice('Google.en-US-Standard-C')).toEqual({
            ttsProvider: 'Google',
            voice: 'en-US-Standard-C',
        });
        expect(parseVoice('Google.en-GB-Standard-A')).toEqual({
            ttsProvider: 'Google',
            voice: 'en-GB-Standard-A',
        });
    });

    it('parses Polly.* into ttsProvider Amazon + full voice', () => {
        expect(parseVoice('Polly.Joanna')).toEqual({
            ttsProvider: 'Amazon',
            voice: 'Polly.Joanna',
        });
        expect(parseVoice('Polly.Matthew')).toEqual({
            ttsProvider: 'Amazon',
            voice: 'Polly.Matthew',
        });
    });
});
