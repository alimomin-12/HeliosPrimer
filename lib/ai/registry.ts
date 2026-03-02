import type { AIAdapter } from './types';
import { openAIAdapter } from './adapters/openai';
import { geminiAdapter } from './adapters/gemini';

export type AIProvider = 'OPENAI' | 'GEMINI';

// API model IDs — these must match the exact model identifier sent to the provider API
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
    OPENAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    GEMINI: [
        // Gemini 2.5 — stable (latest generation)
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        // Gemini 2.5 — preview
        'gemini-2.5-flash-lite-preview-09-2025',
        // Gemini 2.0 — versioned stable
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite-001',
        // Gemini 1.5 — stable, widely available on all keys
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro',
    ],
};

// Human-readable display names for model IDs shown in the UI dropdown
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    // Gemini 2.5
    'gemini-2.5-flash': 'Gemini 2.5 Flash (Stable)',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite (Stable)',
    'gemini-2.5-pro': 'Gemini 2.5 Pro (Stable)',
    'gemini-2.5-flash-lite-preview-09-2025': 'Gemini 2.5 Flash Lite (Preview)',
    // Gemini 2.0
    'gemini-2.0-flash-001': 'Gemini 2.0 Flash (v1)',
    'gemini-2.0-flash-lite-001': 'Gemini 2.0 Flash Lite (v1)',
    // Gemini 1.5
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    // OpenAI
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
};

export const PROVIDER_LABELS: Record<AIProvider, string> = {
    OPENAI: 'OpenAI / ChatGPT',
    GEMINI: 'Google Gemini',
};

export const PROVIDER_COLORS: Record<AIProvider, string> = {
    OPENAI: '#10a37f',
    GEMINI: '#4285f4',
};

export const PROVIDER_DEFAULT_MODEL: Record<AIProvider, string> = {
    OPENAI: 'gpt-4o',
    GEMINI: 'gemini-2.5-flash',
};

export function getAdapter(provider: AIProvider): AIAdapter {
    switch (provider) {
        case 'OPENAI':
            return openAIAdapter;
        case 'GEMINI':
            return geminiAdapter;
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
