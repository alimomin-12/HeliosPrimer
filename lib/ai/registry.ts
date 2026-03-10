import type { AIAdapter } from './types';
import { openAIAdapter } from './adapters/openai';
import { geminiAdapter } from './adapters/gemini';
import { qwenAdapter } from './adapters/qwen';
import { deepSeekAdapter } from './adapters/deepseek';

export type AIProvider = 'OPENAI' | 'GEMINI' | 'QWEN' | 'DEEPSEEK';

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
    QWEN: [
        // Qwen 3 — latest generation
        'qwen3.5-flash',
        'qwen3.5-flash-2026-02-23',
        'qwen3.5-397b-a17b',
        'qwen3.5-122b-a10b',
        'qwen3.5-35b-a3b',
        'qwen3.5-plus',
        'qwen3-vl-235b-a22b-thinking',
        'qwen3-235b-a22b-thinking-2507',
        'qvq-max-2025-03-25',
        'qwen3-vl-flash-2026-01-22',
        'qwen3-235b-a22b',
        'qwen3-30b-a3b',
        'qwen3-coder-plus-2025-09-23',
        'qwen3-coder-480b-a35b-instruct',
        'qwen3-32b',
        'qwen3-14b',
        'qwen3-8b',
        // Qwen 2.5 — stable
        'qwen2.5-72b-instruct',
        'qwen2.5-32b-instruct',
        'qwen2.5-14b-instruct',
        'qwen2.5-7b-instruct',
        // Qwen Max / Plus / Turbo
        'qwen-max',
        'qwen-max-2025-01-25',
        'qwen-plus-latest',
        'qwen3.5-plus-2026-02-15',
        'qwen-plus',
        'qwen-turbo',
        //Qwen Vl Plus models
        'qwen-vl-max',
        'qwen-vl-plus',
        'qwen-vl-plus-latest',
        'qwen-vl-max-2025-08-13',
        'qwen-vl-plus-2025-05-07'
    ],
    DEEPSEEK: [
        // DeepSeek V3 — latest frontier model
        'deepseek-chat',          // DeepSeek-V3 (aliased)
        // DeepSeek R1 — reasoning model
        'deepseek-reasoner',      // DeepSeek-R1 (aliased)
        // Versioned snapshots
        'deepseek-v3-0324',
        'deepseek-r1-0528',
        'deepseek-r1',
        // Specialist
        'deepseek-coder',
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
    // Qwen 3
    'qwen3-235b-a22b': 'Qwen3 235B-A22B (MoE)',
    'qwen3-30b-a3b': 'Qwen3 30B-A3B (MoE)',
    'qwen3-32b': 'Qwen3 32B',
    'qwen3-14b': 'Qwen3 14B',
    'qwen3-8b': 'Qwen3 8B',
    // Qwen 2.5
    'qwen2.5-72b-instruct': 'Qwen2.5 72B Instruct',
    'qwen2.5-32b-instruct': 'Qwen2.5 32B Instruct',
    'qwen2.5-14b-instruct': 'Qwen2.5 14B Instruct',
    'qwen2.5-7b-instruct': 'Qwen2.5 7B Instruct',
    // Qwen API tiers
    'qwen-max': 'Qwen-Max',
    'qwen-plus': 'Qwen-Plus',
    'qwen-turbo': 'Qwen-Turbo',
    // DeepSeek
    'deepseek-chat': 'DeepSeek-V3 (Chat)',
    'deepseek-reasoner': 'DeepSeek-R1 (Reasoner)',
    'deepseek-v3-0324': 'DeepSeek-V3 (Mar 2024)',
    'deepseek-r1-0528': 'DeepSeek-R1 (May 2028)',
    'deepseek-r1': 'DeepSeek-R1',
    'deepseek-coder': 'DeepSeek-Coder',
};

export const PROVIDER_LABELS: Record<AIProvider, string> = {
    OPENAI: 'OpenAI / ChatGPT',
    GEMINI: 'Google Gemini',
    QWEN: 'Alibaba Qwen',
    DEEPSEEK: 'DeepSeek',
};

export const PROVIDER_COLORS: Record<AIProvider, string> = {
    OPENAI: '#10a37f',
    GEMINI: '#4285f4',
    QWEN: '#6240da',
    DEEPSEEK: '#00d4c8',
};

export const PROVIDER_DEFAULT_MODEL: Record<AIProvider, string> = {
    OPENAI: 'gpt-4o',
    GEMINI: 'gemini-2.5-flash',
    QWEN: 'qwen-plus',
    DEEPSEEK: 'deepseek-chat',
};

export function getAdapter(provider: AIProvider): AIAdapter {
    switch (provider) {
        case 'OPENAI':
            return openAIAdapter;
        case 'GEMINI':
            return geminiAdapter;
        case 'QWEN':
            return qwenAdapter;
        case 'DEEPSEEK':
            return deepSeekAdapter;
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
