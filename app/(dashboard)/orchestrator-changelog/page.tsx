'use client';

import { ORCHESTRATOR_VERSIONS } from '@/lib/ai/orchestratorVersions';

export default function OrchestratorChangelogPage() {
    // Reverse the array to show the most recent version first
    const reversedVersions = [...ORCHESTRATOR_VERSIONS].reverse();

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>
                    Orchestrator Tracking
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, maxWidth: 600, lineHeight: 1.5 }}>
                    The evolution of HeliosPrimer's orchestration engine. A chronological history of its upgrades, logic transitions, and combo names.
                </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
                    {/* Timeline line */}
                    <div style={{
                        position: 'absolute',
                        left: 19,
                        top: 10,
                        bottom: 40,
                        width: 2,
                        background: 'var(--border)',
                        borderRadius: 2
                    }} />

                    {reversedVersions.map((v, idx) => {
                        const isLatest = idx === 0;
                        return (
                            <div key={v.version} style={{ position: 'relative', display: 'flex', gap: 24, paddingBottom: 40 }}>
                                {/* Timeline Dot */}
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: isLatest ? 'var(--accent-purple)' : 'var(--bg-card)',
                                    border: isLatest ? '2px solid rgba(124,92,252,0.3)' : '2px solid var(--border-bright)',
                                    color: isLatest ? 'white' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: 700, zIndex: 2,
                                    flexShrink: 0
                                }}>
                                    {isLatest ? '🌟' : '⚙️'}
                                </div>

                                {/* Content Card */}
                                <div style={{
                                    flex: 1,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    padding: '24px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                }}>
                                    {isLatest && (
                                        <div style={{
                                            position: 'absolute',
                                            top: -10, right: 20,
                                            background: 'var(--accent-purple)',
                                            color: 'white',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            letterSpacing: '0.05em'
                                        }}>
                                            LATEST ARCHITECTURE
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                                        <div>
                                            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                                                {v.name}
                                            </h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 6 }}>
                                                    v{v.version}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {v.date}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                                        {v.summary}
                                    </div>

                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                                            Key Features
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {v.features.map(f => (
                                                <div key={f} style={{
                                                    background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)',
                                                    color: 'var(--accent-blue)',
                                                    padding: '6px 12px',
                                                    borderRadius: 8,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600
                                                }}>
                                                    {f}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
