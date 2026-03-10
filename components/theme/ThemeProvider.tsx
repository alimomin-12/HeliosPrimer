'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type ThemeId, getSavedTheme, saveTheme, applyTheme } from '@/lib/theme';

interface ThemeContextValue {
    theme: ThemeId;
    setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    setTheme: () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>('dark');

    // Hydrate from localStorage on mount, apply to DOM
    useEffect(() => {
        const saved = getSavedTheme();
        setThemeState(saved);
        applyTheme(saved);
    }, []);

    const setTheme = (id: ThemeId) => {
        setThemeState(id);
        saveTheme(id);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
