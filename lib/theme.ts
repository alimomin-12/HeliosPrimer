export type ThemeId = 'dark' | 'light' | 'neon' | 'gray' | 'corporate' | 'simple';

export interface ThemeDef {
    id: ThemeId;
    label: string;
    icon: string;
    description: string;
    /** Swatch colors [bg, accent] for the preview pill */
    swatch: [string, string];
}

export const THEMES: ThemeDef[] = [
    {
        id: 'dark',
        label: 'Dark',
        icon: '🌑',
        description: 'Deep navy / purple — the default',
        swatch: ['#0a0a0f', '#7c5cfc'],
    },
    {
        id: 'light',
        label: 'Light',
        icon: '☀️',
        description: 'Clean white with vibrant accents',
        swatch: ['#f5f5fa', '#6d4ae8'],
    },
    {
        id: 'neon',
        label: 'Neon',
        icon: '⚡',
        description: 'Cyberpunk electric glow',
        swatch: ['#060610', '#39ff14'],
    },
    {
        id: 'gray',
        label: 'Gray',
        icon: '🩶',
        description: 'Refined monochrome slate',
        swatch: ['#111114', '#818cf8'],
    },
    {
        id: 'corporate',
        label: 'Corporate',
        icon: '🏢',
        description: 'Frosted glass, calm neutral tones',
        swatch: ['#1a1b1f', '#a0a8c8'],
    },
    {
        id: 'simple',
        label: 'Warm Simple',
        icon: '☕',
        description: 'Warm, earth-toned creams with light shadows',
        swatch: ['#fcf9f2', '#e07a5f'],
    },
];

export const STORAGE_KEY = 'heliosprimer-theme';

export function applyTheme(id: ThemeId) {
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', id);
    }
}

export function getSavedTheme(): ThemeId {
    if (typeof localStorage === 'undefined') return 'dark';
    return (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'dark';
}

export function saveTheme(id: ThemeId) {
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
}
