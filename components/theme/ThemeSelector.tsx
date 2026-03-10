'use client';

import { useState } from 'react';
import { THEMES, type ThemeId } from '@/lib/theme';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function ThemeSelector() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

    return (
        <div style={{ position: 'relative', marginBottom: 8 }}>
            {/* Trigger button */}
            <button
                onClick={() => setOpen((v) => !v)}
                title="Change theme"
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-bright)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    fontSize: '0.85rem',
                }}
            >
                {/* Swatch dot */}
                <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: `linear-gradient(135deg, ${current.swatch[0]} 0%, ${current.swatch[1]} 100%)`,
                    border: '2px solid var(--border-bright)',
                    display: 'inline-block',
                }} />
                <span style={{ flex: 1, fontWeight: 500 }}>
                    {current.icon} {current.label}
                </span>
                <span style={{
                    fontSize: '0.6rem', color: 'var(--text-muted)',
                    transition: 'transform 0.2s',
                    transform: open ? 'rotate(180deg)' : 'none',
                }}>▼</span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setOpen(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 998,
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0, right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 14,
                        padding: 8,
                        zIndex: 999,
                        boxShadow: 'var(--theme-shadow)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                    }}>
                        <div style={{
                            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em',
                            textTransform: 'uppercase', color: 'var(--text-muted)',
                            padding: '2px 8px 6px',
                        }}>
                            🎨 Select Theme
                        </div>
                        {THEMES.map((t) => {
                            const selected = t.id === theme;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => { setTheme(t.id as ThemeId); setOpen(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '9px 10px',
                                        borderRadius: 9,
                                        border: selected
                                            ? '1px solid var(--accent-purple)'
                                            : '1px solid transparent',
                                        background: selected
                                            ? 'rgba(var(--accent-purple-rgb, 124,92,252), 0.08)'
                                            : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'all 0.12s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    {/* Color swatch */}
                                    <span style={{
                                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                        background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[1]} 100%)`,
                                        border: selected ? '2px solid var(--accent-purple)' : '2px solid var(--border)',
                                        display: 'inline-block',
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.82rem', fontWeight: selected ? 700 : 500,
                                            color: selected ? 'var(--accent-purple)' : 'var(--text-primary)',
                                            fontFamily: 'Inter, sans-serif',
                                        }}>
                                            {t.icon} {t.label}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                            {t.description}
                                        </div>
                                    </div>
                                    {selected && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', flexShrink: 0 }}>✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
