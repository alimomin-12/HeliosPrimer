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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, TestState>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [devKeys, setDevKeys] = useState<Record<string, string>>({});
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
        fetchConnections();
        fetchDevKeys();
    }, []);

    async function fetchConnections() {
        const res = await fetch('/api/connections');
        if (res.ok) setConnections(await res.json());
        setLoading(false);
    }

    async function fetchDevKeys() {
        try {
            const res = await fetch('/api/dev/keys');
            if (res.ok) setDevKeys(await res.json());
        } catch (err) {
            console.error('Failed to fetch dev keys:', err);
        }
    }

    function handleProviderChange(p: AIProvider) {
        setSelectedProvider(p);
        setModel(PROVIDER_DEFAULT_MODEL[p]);
        setMessage(null);
    }

    async function handleEdit(conn: AIConnection) {
        setEditingId(conn.id);
        setSelectedProvider(conn.provider as AIProvider);
        setModel(conn.model);
        setLabel(conn.label || '');
        setApiKey('');
        setMessage(null);
        // Fetch the decrypted key so the user can see/edit it
        try {
            const res = await fetch(`/api/connections?id=${conn.id}`);
            if (res.ok) {
                const data = await res.json();
                setApiKey(data.apiKey ?? '');
            }
        } catch (err) {
            console.error('Failed to fetch connection key:', err);
        }
    }

    function resetForm() {
        setEditingId(null);
        setApiKey('');
        setLabel('');
        setShowApiKey(false);
        setModel(PROVIDER_DEFAULT_MODEL[selectedProvider]);
    }

    function fillDevKey() {
        if (devKeys[selectedProvider]) {
            setApiKey(devKeys[selectedProvider]);
            setMessage({ type: 'success', text: '🧪 Dev key applied!' });
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const payload: any = { provider: selectedProvider, apiKey, model, label };
        if (editingId) payload.id = editingId;

        const res = await fetch('/api/connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const savedConn = await res.json();
            setMessage({ type: 'success', text: `✅ Saved! Testing...` });
            resetForm();
            await fetchConnections();
            setTimeout(() => handleTest(savedConn.id), 500);
        } else {
            setMessage({ type: 'error', text: '❌ Failed to save.' });
        }
        setSaving(false);
    }

    async function handleTest(connectionId: string) {
        setTesting(connectionId);
        setTestResult((prev) => ({ ...prev, [connectionId]: { valid: null } }));
        const res = await fetch('/api/connections/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId }),
        });
        const data = await res.json();
        setTestResult((prev) => ({
            ...prev,
            [connectionId]: { valid: data.valid, error: data.error, model: data.model },
        }));
        setTesting(null);
    }

    async function handleDelete(id: string) {
        await fetch(`/api/connections?id=${id}`, { method: 'DELETE' });
        if (editingId === id) resetForm();
        fetchConnections();
    }

    return (
        <div style={{ padding: '24px 30px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <h1
                    style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        marginBottom: 4,
                    }}
                >
                    Connect <span className="gradient-text">AI Bricks</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Assemble your swarm of intelligent models
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: connections.length > 0 ? '400px 1fr' : '1fr', gap: 32, alignItems: 'start' }}>
                {/* Form Sidebar / Centered */}
                <div style={{ maxWidth: connections.length > 0 ? 'none' : 500, margin: connections.length > 0 ? '0' : '0 auto', width: '100%' }}>
                    <div className="glass-card" style={{ padding: 24, border: '1px solid var(--border)', background: 'var(--bg-card)', position: 'sticky', top: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                                {editingId ? '⚡ Update Connection' : '🧩 New Connection'}
                            </h2>
                            {editingId && (
                                <button
                                    onClick={resetForm}
                                    style={{
                                        fontSize: '0.7rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        {/* Provider selection pills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                            {PROVIDERS.map((p) => {
                                const active = selectedProvider === p;
                                const color = PROVIDER_COLORS[p];
                                return (
                                    <button
                                        key={p}
                                        onClick={() => handleProviderChange(p)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid',
                                            borderColor: active ? color : 'var(--border)',
                                            background: active ? `${color}15` : 'transparent',
                                            color: active ? color : 'var(--text-muted)',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <span>{PROVIDER_ICONS[p]}</span>
                                        <span>{PROVIDER_LABELS[p]}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>API KEY</label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {devKeys[selectedProvider] && (
                                            <button
                                                type="button"
                                                onClick={fillDevKey}
                                                style={{
                                                    fontSize: '0.65rem',
                                                    background: 'var(--accent-purple)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    padding: '2px 6px',
                                                    cursor: 'pointer',
                                                    opacity: 0.8
                                                }}
                                            >
                                                🧪 Local Key
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input-field"
                                        type={showApiKey ? 'text' : 'password'}
                                        placeholder="Enter your API Key..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        required
                                        style={{ padding: '10px 40px 10px 12px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        title={showApiKey ? 'Hide key' : 'Show key'}
                                        style={{
                                            position: 'absolute',
                                            right: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            color: 'var(--text-muted)',
                                            lineHeight: 1,
                                            padding: 0
                                        }}
                                    >
                                        {showApiKey ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MODEL</label>
                                <select
                                    className="select-field"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    style={{ padding: '10px 12px', fontSize: '0.85rem' }}
                                >
                                    {PROVIDER_MODELS[selectedProvider].map((m) => (
                                        <option key={m} value={m}>{MODEL_DISPLAY_NAMES[m] ?? m}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>IDENTIFIER (OPTIONAL)</label>
                                <input
                                    className="input-field"
                                    type="text"
                                    placeholder="e.g. Production, Experiments..."
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    style={{ padding: '10px 12px', fontSize: '0.85rem' }}
                                />
                            </div>

                            {message && (
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    background: message.type === 'success' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                                }}>
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={saving}
                                style={{
                                    padding: '12px',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    background: PROVIDER_COLORS[selectedProvider],
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {saving ? 'SAVING...' : editingId ? 'UPDATE BRICK' : 'ADD BRICK'}
                            </button>
                        </form>

                        {/* Provider-specific help */}
                        {selectedProvider && (
                            <div
                                style={{
                                    marginTop: 20,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid var(--border)`,
                                    borderRadius: 12,
                                    padding: '12px 14px',
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: PROVIDER_COLORS[selectedProvider], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{PROVIDER_ICONS[selectedProvider]}</span>
                                    <span>{PROVIDER_LABELS[selectedProvider]} Tips</span>
                                </div>
                                <ul style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.6, paddingLeft: 12, margin: 0 }}>
                                    {selectedProvider === 'OPENAI' && (
                                        <>
                                            <li>Manage keys at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>platform.openai.com</a></li>
                                            <li>Keys start with <code>sk-</code></li>
                                        </>
                                    )}
                                    {selectedProvider === 'GEMINI' && (
                                        <>
                                            <li>Free keys at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>aistudio.google.com</a></li>
                                            <li>Keys start with <code>AIza</code></li>
                                        </>
                                    )}
                                    {selectedProvider === 'QWEN' && (
                                        <>
                                            <li>Keys at <a href="https://dashscope-intl.aliyuncs.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>dashscope-intl.aliyuncs.com</a></li>
                                            <li>Keys start with <code>sk-</code></li>
                                        </>
                                    )}
                                    {selectedProvider === 'DEEPSEEK' && (
                                        <>
                                            <li>Keys at <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>platform.deepseek.com</a></li>
                                            <li>Keys start with <code>sk-</code></li>
                                        </>
                                    )}
                                    <li>Test fails? Check model API tier support.</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Connections Grid */}
                {connections.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Active Fleet ({connections.length})
                            </h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                            {connections.map((conn) => {
                                const color = PROVIDER_COLORS[conn.provider as AIProvider] || '#7c5cfc';
                                const tr = testResult[conn.id];
                                const isTesting = testing === conn.id;
                                const isOnline = tr?.valid === true;
                                const isFailed = tr?.valid === false;
                                const isEditing = editingId === conn.id;

                                return (
                                    <div
                                        key={conn.id}
                                        style={{
                                            borderRadius: 16,
                                            border: isEditing ? `1.5px solid ${color}` : '1px solid var(--border)',
                                            background: 'var(--bg-card)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflow: 'hidden',
                                            transition: 'box-shadow 0.2s, transform 0.2s',
                                            boxShadow: isEditing ? `0 0 16px ${color}30` : '0 4px 16px rgba(0,0,0,0.12)',
                                        }}
                                    >
                                        {/* Gradient accent bar at top */}
                                        <div style={{
                                            height: 4,
                                            background: `linear-gradient(90deg, ${color}, ${color}60)`,
                                        }} />

                                        <div style={{ padding: '16px 16px 14px' }}>
                                            {/* Provider icon + name row */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                                <div style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 12,
                                                    background: `${color}18`,
                                                    border: `1px solid ${color}30`,
                                                    color: color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.5rem',
                                                    flexShrink: 0,
                                                }}>
                                                    {PROVIDER_ICONS[conn.provider as AIProvider]}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {/* Full provider name */}
                                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                                                        {PROVIDER_LABELS[conn.provider as AIProvider]}
                                                    </div>
                                                    {/* Label (identifier) */}
                                                    {conn.label && (
                                                        <div style={{
                                                            fontSize: '0.7rem',
                                                            color: color,
                                                            fontWeight: 600,
                                                            marginTop: 2,
                                                            opacity: 0.9,
                                                            letterSpacing: '0.02em',
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {conn.label}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Status pill */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '4px 8px',
                                                    borderRadius: 20,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.03em',
                                                    background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                                                    color: isOnline ? '#10b981' : 'var(--text-muted)',
                                                    border: isOnline ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border)',
                                                    flexShrink: 0,
                                                }}>
                                                    <span style={{
                                                        width: 5, height: 5, borderRadius: '50%',
                                                        background: isOnline ? '#10b981' : isFailed ? '#ef4444' : '#6b7280',
                                                        display: 'inline-block'
                                                    }} />
                                                    {isOnline ? 'Online' : isFailed ? 'Error' : 'Idle'}
                                                </div>
                                            </div>

                                            {/* Model chip */}
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                background: `${color}10`,
                                                border: `1px solid ${color}25`,
                                                fontSize: '0.68rem',
                                                fontWeight: 600,
                                                color,
                                                marginBottom: 14,
                                                fontFamily: 'monospace',
                                                letterSpacing: '0.02em',
                                            }}>
                                                ⚙ {conn.model}
                                            </div>

                                            {/* Error message */}
                                            {isFailed && tr.error && (
                                                <div style={{
                                                    fontSize: '0.68rem',
                                                    color: '#fca5a5',
                                                    marginBottom: 10,
                                                    padding: '6px 10px',
                                                    background: 'rgba(239,68,68,0.06)',
                                                    borderRadius: 6,
                                                    border: '1px solid rgba(239,68,68,0.15)',
                                                    lineHeight: 1.4
                                                }}>
                                                    {tr.error.slice(0, 70)}{tr.error.length > 70 ? '…' : ''}
                                                </div>
                                            )}

                                            {/* Action row */}
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    onClick={() => handleTest(conn.id)}
                                                    disabled={isTesting}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px',
                                                        borderRadius: 8,
                                                        border: '1px solid var(--border)',
                                                        background: isOnline ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)',
                                                        color: isOnline ? '#10b981' : 'var(--text-muted)',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        cursor: isTesting ? 'default' : 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {isTesting ? '⏳ Testing...' : isOnline ? '✓ Online' : isFailed ? '↺ Retry' : 'Test'}
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(conn)}
                                                    title="Edit connection"
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: 8,
                                                        border: `1px solid ${color}30`,
                                                        background: `${color}0d`,
                                                        color,
                                                        cursor: 'pointer',
                                                        fontSize: '0.82rem',
                                                    }}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(conn.id)}
                                                    title="Delete connection"
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(239,68,68,0.2)',
                                                        background: 'rgba(239,68,68,0.05)',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        fontSize: '0.82rem',
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
