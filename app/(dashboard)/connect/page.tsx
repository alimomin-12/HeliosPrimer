'use client';

import { useState, useEffect } from 'react';
import { PROVIDER_LABELS, PROVIDER_COLORS, PROVIDER_MODELS, PROVIDER_DEFAULT_MODEL, MODEL_DISPLAY_NAMES, type AIProvider } from '@/lib/ai/registry';

const PROVIDERS: AIProvider[] = ['OPENAI', 'GEMINI', 'QWEN', 'DEEPSEEK'];

const PROVIDER_ICONS: Record<AIProvider, string> = {
    OPENAI: '◎',
    GEMINI: '✦',
    QWEN: '⬡',
    DEEPSEEK: '🐋',
};

const PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
    OPENAI: 'GPT-4o, GPT-4o Mini, GPT-4 Turbo — Advanced reasoning and code generation',
    GEMINI: 'Gemini 2.5 Flash, 2.5 Pro, 1.5 Pro — Multimodal, long context, Google-grade intelligence',
    QWEN: 'Qwen3, Qwen2.5, Qwen-Max/Plus/Turbo — Alibaba\'s multilingual reasoning models via DashScope API',
    DEEPSEEK: 'DeepSeek-V3, DeepSeek-R1 — Frontier reasoning and coding models from DeepSeek AI',
};

interface AIConnection {
    id: string;
    provider: string;
    model: string;
    isActive: boolean;
    label: string | null;
}

interface TestState {
    valid: boolean | null;
    error?: string;
    model?: string;
}

export default function ConnectPage() {
    const [connections, setConnections] = useState<AIConnection[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('OPENAI');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState(PROVIDER_DEFAULT_MODEL['OPENAI']);
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, TestState>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConnections();
    }, []);

    async function fetchConnections() {
        const res = await fetch('/api/connections');
        if (res.ok) setConnections(await res.json());
        setLoading(false);
    }

    function handleProviderChange(p: AIProvider) {
        setSelectedProvider(p);
        setModel(PROVIDER_DEFAULT_MODEL[p]);
        setMessage(null);
    }

    // Pre-fill the form to update an existing connection
    function handleEdit(conn: AIConnection) {
        setSelectedProvider(conn.provider as AIProvider);
        setModel(conn.model);
        setLabel(conn.label || '');
        setMessage(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const res = await fetch('/api/connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider, apiKey, model, label }),
        });

        if (res.ok) {
            setMessage({ type: 'success', text: '✅ Connection saved! Testing it now...' });
            setApiKey('');
            setLabel('');
            await fetchConnections();
            // Auto-test after saving
            setTimeout(() => handleTest(selectedProvider), 500);
        } else {
            setMessage({ type: 'error', text: '❌ Failed to save connection.' });
        }
        setSaving(false);
    }

    async function handleTest(provider: string) {
        setTesting(provider);
        setTestResult((prev) => ({ ...prev, [provider]: { valid: null } }));
        const res = await fetch('/api/connections/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        setTestResult((prev) => ({
            ...prev,
            [provider]: { valid: data.valid, error: data.error, model: data.model },
        }));
        setTesting(null);
    }

    async function handleDelete(id: string, provider: string) {
        await fetch(`/api/connections?id=${id}`, { method: 'DELETE' });
        setTestResult((prev) => {
            const next = { ...prev };
            delete next[provider];
            return next;
        });
        fetchConnections();
    }

    return (
        <div style={{ padding: '36px 40px', maxWidth: 900 }}>
            <div style={{ marginBottom: 36 }}>
                <h1
                    style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        marginBottom: 6,
                    }}
                >
                    Connect <span className="gradient-text">Your AIs</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Add your AI provider API keys to start orchestrating
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                {/* Add/Update connection form */}
                <div className="glass-card" style={{ padding: 28 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 20, fontFamily: 'Space Grotesk, sans-serif' }}>
                        Add / Update Connection
                    </h2>

                    {/* Provider selector */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                        {PROVIDERS.map((p) => {
                            const color = PROVIDER_COLORS[p];
                            const active = selectedProvider === p;
                            return (
                                <button
                                    key={p}
                                    onClick={() => handleProviderChange(p)}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: 12,
                                        border: active ? `2px solid ${color}` : '2px solid var(--border)',
                                        background: active ? `${color}15` : 'var(--bg-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{ fontSize: '1.6rem', color: active ? color : 'var(--text-muted)', marginBottom: 6 }}>
                                        {PROVIDER_ICONS[p]}
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: active ? color : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                                        {PROVIDER_LABELS[p]}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.79rem', marginBottom: 18, lineHeight: 1.5 }}>
                        {PROVIDER_DESCRIPTIONS[selectedProvider]}
                    </p>

                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                API Key *
                            </label>
                            <input
                                className="input-field"
                                type="password"
                                placeholder={selectedProvider === 'GEMINI' ? 'AIza...' : selectedProvider === 'QWEN' ? 'sk-... (DashScope)' : 'sk-...'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                required
                            />
                            {selectedProvider === 'GEMINI' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                                    Get your key at{' '}
                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#4285f4' }}
                                    >
                                        aistudio.google.com/apikey
                                    </a>
                                </p>
                            )}
                            {selectedProvider === 'QWEN' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                                    Get your DashScope API key at{' '}
                                    <a
                                        href="https://dashscope-intl.aliyuncs.com"
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#6240da' }}
                                    >
                                        dashscope-intl.aliyuncs.com
                                    </a>
                                </p>
                            )}
                            {selectedProvider === 'DEEPSEEK' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                                    Get your API key at{' '}
                                    <a
                                        href="https://platform.deepseek.com/api_keys"
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#00d4c8' }}
                                    >
                                        platform.deepseek.com
                                    </a>
                                </p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                Model *
                            </label>
                            <select
                                className="select-field"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            >
                                {PROVIDER_MODELS[selectedProvider].map((m) => (
                                    <option key={m} value={m}>{MODEL_DISPLAY_NAMES[m] ?? m}</option>
                                ))}
                            </select>
                            {selectedProvider === 'GEMINI' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                                    💡 Recommended: <strong style={{ color: '#4285f4' }}>gemini-2.5-flash-lite/*</strong> — fastest & most capable free-tier model
                                </p>
                            )}
                            {selectedProvider === 'DEEPSEEK' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                                    💡 Recommended: <strong style={{ color: '#00d4c8' }}>deepseek-chat</strong> — High performance frontier model (DeepSeek-V3)
                                </p>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                Label (optional)
                            </label>
                            <input
                                className="input-field"
                                type="text"
                                placeholder={`e.g. My ${PROVIDER_LABELS[selectedProvider]} Key`}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                        </div>

                        {message && (
                            <div
                                style={{
                                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                                    fontSize: '0.85rem',
                                }}
                            >
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '12px' }}>
                            <span>{saving ? 'Saving...' : `Save ${PROVIDER_LABELS[selectedProvider]} Connection`}</span>
                        </button>
                    </form>
                </div>

                {/* Current connections */}
                <div>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16, fontFamily: 'Space Grotesk, sans-serif' }}>
                        Your Connections
                    </h2>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[1, 2].map((i) => <div key={i} className="shimmer" style={{ height: 110 }} />)}
                        </div>
                    ) : connections.length === 0 ? (
                        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔌</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                No connections yet. Add your first AI above.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {connections.map((conn) => {
                                const color = PROVIDER_COLORS[conn.provider as AIProvider] || '#7c5cfc';
                                const tr = testResult[conn.provider];
                                const isTesting = testing === conn.provider;
                                return (
                                    <div key={conn.id} className="glass-card" style={{ padding: '18px 20px' }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    background: `${color}20`,
                                                    border: `1px solid ${color}40`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.3rem',
                                                    flexShrink: 0,
                                                    color,
                                                }}
                                            >
                                                {PROVIDER_ICONS[conn.provider as AIProvider]}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                    {PROVIDER_LABELS[conn.provider as AIProvider]}
                                                    {conn.label && (
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                                            {' '}· {conn.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ color: color, fontSize: '0.75rem', marginTop: 2, fontWeight: 500 }}>
                                                    {conn.model}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div
                                                    style={{
                                                        width: 7,
                                                        height: 7,
                                                        borderRadius: '50%',
                                                        background: conn.isActive ? '#10b981' : '#ef4444',
                                                    }}
                                                />
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {conn.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Test error message */}
                                        {tr && tr.valid === false && tr.error && (
                                            <div
                                                style={{
                                                    background: 'rgba(239,68,68,0.07)',
                                                    border: '1px solid rgba(239,68,68,0.2)',
                                                    borderRadius: 8,
                                                    padding: '8px 12px',
                                                    marginBottom: 10,
                                                    fontSize: '0.76rem',
                                                    color: '#fca5a5',
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                <strong>Error:</strong> {tr.error.slice(0, 180)}
                                                {tr.error.length > 180 ? '...' : ''}
                                                <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                                                    💡 Try updating this connection with a different model or re-entering your API key.
                                                </div>
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => handleTest(conn.provider)}
                                                disabled={isTesting}
                                                style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }}
                                            >
                                                {isTesting
                                                    ? '⏳ Testing...'
                                                    : tr?.valid === true
                                                        ? '✅ Valid'
                                                        : tr?.valid === false
                                                            ? '❌ Invalid — Retry'
                                                            : '🔍 Test Key'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(conn)}
                                                style={{
                                                    padding: '7px 14px',
                                                    borderRadius: 8,
                                                    border: `1px solid ${color}40`,
                                                    background: `${color}10`,
                                                    color,
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontFamily: 'Inter, sans-serif',
                                                }}
                                            >
                                                ✏️ Update
                                            </button>
                                            <button
                                                onClick={() => handleDelete(conn.id, conn.provider)}
                                                style={{
                                                    padding: '7px 12px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(239,68,68,0.2)',
                                                    background: 'rgba(239,68,68,0.05)',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontFamily: 'Inter, sans-serif',
                                                }}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Provider-specific help */}
                    {selectedProvider && (
                        <div
                            style={{
                                marginTop: 16,
                                background: `${PROVIDER_COLORS[selectedProvider]}08`,
                                border: `1px solid ${PROVIDER_COLORS[selectedProvider]}30`,
                                borderRadius: 12,
                                padding: '14px 16px',
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: PROVIDER_COLORS[selectedProvider], marginBottom: 6 }}>
                                {PROVIDER_ICONS[selectedProvider]} {PROVIDER_LABELS[selectedProvider]} API Key Tips
                            </div>
                            <ul style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.7, paddingLeft: 16 }}>
                                {selectedProvider === 'OPENAI' && (
                                    <>
                                        <li>Manage your keys at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: PROVIDER_COLORS.OPENAI }}>platform.openai.com</a></li>
                                        <li>Usage is pay-as-you-go; ensure you have credits in your account</li>
                                        <li>Keys start with <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>sk-</code></li>
                                    </>
                                )}
                                {selectedProvider === 'GEMINI' && (
                                    <>
                                        <li>Get your free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: PROVIDER_COLORS.GEMINI }}>aistudio.google.com/apikey</a></li>
                                        <li>Use <strong style={{ color: 'var(--text-secondary)' }}>gemini-2.5-flash-lite</strong> — available for free</li>
                                        <li>Keys start with <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>AIza</code></li>
                                    </>
                                )}
                                {selectedProvider === 'QWEN' && (
                                    <>
                                        <li>Get your key at <a href="https://dashscope-intl.aliyuncs.com" target="_blank" rel="noreferrer" style={{ color: PROVIDER_COLORS.QWEN }}>dashscope-intl.aliyuncs.com</a></li>
                                        <li>Use <strong style={{ color: 'var(--text-secondary)' }}>qwen-plus</strong> for the best balanced performance</li>
                                        <li>Keys start with <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>sk-</code></li>
                                    </>
                                )}
                                {selectedProvider === 'DEEPSEEK' && (
                                    <>
                                        <li>Get your key at <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" style={{ color: PROVIDER_COLORS.DEEPSEEK }}>platform.deepseek.com</a></li>
                                        <li>Highly recommended: <strong style={{ color: 'var(--text-secondary)' }}>deepseek-chat</strong> (V3) or <strong style={{ color: 'var(--text-secondary)' }}>deepseek-reasoner</strong> (R1)</li>
                                        <li>Keys start with <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>sk-</code></li>
                                    </>
                                )}
                                <li>If a test connection fails, verify you have chosen a model supported by your API key tier</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
