'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider } from '@/lib/ai/registry';

interface AIConnection {
    id: string;
    provider: string;
    model: string;
    isActive: boolean;
    label: string | null;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'master' | 'slave' | 'system';
    content: string;
    provider?: string;
    thinkingStep?: boolean;
    type?: 'thinking' | 'delegation' | 'slave_response' | 'final' | 'user';
    question?: string;
    delegateTo?: string;
    tokenCount?: number;
}

interface TokenStats {
    totalTokens: number;
    contextMessages: number;
    inputTokens: number;
    outputTokens: number;
}

const PROVIDER_ICONS: Record<string, string> = { OPENAI: '◎', GEMINI: '✦' };

// Monotonic counter — avoids duplicate React keys when steps arrive in the same ms
let __stepId = 0;
function nextStepId() { return String(++__stepId); }

// Rough token estimator: ~4 chars per token
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function ChatContent() {
    const searchParams = useSearchParams();
    const initMode = searchParams.get('mode') || 'DIRECT';
    const initConvId = searchParams.get('id');

    const [connections, setConnections] = useState<AIConnection[]>([]);
    const [mode, setMode] = useState<'DIRECT' | 'ORCHESTRATED'>(initMode as 'DIRECT' | 'ORCHESTRATED');
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [masterProvider, setMasterProvider] = useState<string>('');
    const [slaveProviders, setSlaveProviders] = useState<string[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [thinkingSteps, setThinkingSteps] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(initConvId);
    const [showPanel, setShowPanel] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
    const [tokenStats, setTokenStats] = useState<TokenStats>({ totalTokens: 0, contextMessages: 0, inputTokens: 0, outputTokens: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Update token stats whenever messages change
    useEffect(() => {
        const allText = messages.map((m) => m.content).join('');
        const inputText = messages.filter((m) => m.role === 'user').map((m) => m.content).join('');
        const outputText = messages.filter((m) => m.role !== 'user').map((m) => m.content).join('');
        setTokenStats({
            totalTokens: estimateTokens(allText),
            contextMessages: messages.length,
            inputTokens: estimateTokens(inputText),
            outputTokens: estimateTokens(outputText),
        });
    }, [messages]);

    // Load connections
    useEffect(() => {
        fetch('/api/connections').then((r) => r.json()).then((data) => {
            const active = data.filter((c: AIConnection) => c.isActive);
            setConnections(active);
            if (active.length > 0) {
                setSelectedProvider(active[0].provider);
                setMasterProvider(active[0].provider);
                if (active.length > 1) setSlaveProviders([active[1].provider]);
            }
        });
    }, []);

    // Load conversation history when ?id= is present
    const loadConversation = useCallback(async (id: string) => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/conversations/${id}`);
            if (!res.ok) return;
            const conv = await res.json();

            // Set mode from conversation
            if (conv.mode) setMode(conv.mode as 'DIRECT' | 'ORCHESTRATED');

            // Map stored messages to ChatMessage format
            // Filter out thinking-step messages (internal orchestration intermediates)
            const loaded: ChatMessage[] = conv.messages
                .filter((m: { thinkingStep?: boolean; role: string }) => !m.thinkingStep)
                .map((m: { id: string; role: string; content: string; provider?: string }) => ({
                    id: m.id,
                    // DB stores 'master' for AI responses in both direct and orchestrated
                    role: (m.role === 'master' || m.role === 'assistant') ? 'master' : m.role as ChatMessage['role'],
                    content: m.content,
                    provider: m.provider,
                    type: m.role === 'user' ? 'user' : 'final',
                }));
            setMessages(loaded);

            // If orchestrated, restore providers from config
            if (conv.orchestrationConfig) {
                setMasterProvider(conv.orchestrationConfig.masterProvider);
                // slaveProviders is stored as JSON string in DB — must parse it
                let slaves: string[] = [];
                try {
                    slaves = JSON.parse(conv.orchestrationConfig.slaveProviders || '[]');
                } catch {
                    slaves = [];
                }
                setSlaveProviders(slaves);
            }
        } catch (err) {
            console.error('[loadConversation] failed:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, []);


    useEffect(() => {
        if (initConvId) {
            loadConversation(initConvId);
        }
    }, [initConvId, loadConversation]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, thinkingSteps]);

    async function ensureConversation() {
        if (conversationId) return conversationId;
        const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
        });
        const conv = await res.json();
        setConversationId(conv.id);
        return conv.id;
    }

    async function sendMessage() {
        if (!input.trim() || streaming) return;
        const userMsg = input.trim();
        setInput('');
        setStreaming(true);

        const userChatMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userMsg,
            type: 'user',
        };
        setMessages((prev) => [...prev, userChatMsg]);
        setThinkingSteps([]);

        const convId = await ensureConversation();

        const history = messages
            .filter((m) => m.role === 'user' || (m.role === 'master' && !m.thinkingStep))
            .map((m) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            }));

        if (mode === 'DIRECT') {
            await runDirectChat(userMsg, convId, history);
        } else {
            await runOrchestratedChat(userMsg, convId, history);
        }

        setStreaming(false);
    }

    async function runDirectChat(userMsg: string, convId: string, history: { role: string; content: string }[]) {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: convId, provider: selectedProvider, message: userMsg, history }),
        });

        const reader = res.body?.getReader();
        if (!reader) return;

        const msgId = Date.now().toString();
        let outputText = '';
        setMessages((prev) => [
            ...prev,
            { id: msgId, role: 'master', content: '', provider: selectedProvider, type: 'final' },
        ]);

        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            outputText += parsed.content;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === msgId ? { ...m, content: m.content + parsed.content } : m
                                )
                            );
                        }
                    } catch { }
                }
            }
        }
    }

    async function runOrchestratedChat(userMsg: string, convId: string, history: { role: string; content: string }[]) {
        const res = await fetch('/api/orchestrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversationId: convId,
                masterProvider,
                slaveProviders,
                message: userMsg,
                history,
            }),
        });

        const reader = res.body?.getReader();
        if (!reader) return;

        const finalMsgId = Date.now().toString();
        let finalStarted = false;
        setOrchestrationError(null);

        const decoder = new TextDecoder();
        let buffer = '';
        outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') break outer;
                try {
                    const step = JSON.parse(data);
                    if (step.type === 'error') {
                        setOrchestrationError(step.content || 'Orchestration failed');
                        // Remove the empty user message placeholder
                        setMessages((prev) => prev.filter((m) => m.id !== finalMsgId));
                        break outer;
                    } else if (step.type === 'thinking') {
                        setThinkingSteps((prev) => [
                            ...prev,
                            { id: nextStepId(), role: 'master', type: 'thinking', content: step.content, provider: step.provider },
                        ]);
                    } else if (step.type === 'delegation') {
                        setThinkingSteps((prev) => [
                            ...prev,
                            { id: nextStepId(), role: 'system', type: 'delegation', content: step.content, delegateTo: step.delegateTo, question: step.question },
                        ]);
                    } else if (step.type === 'slave_response') {
                        setThinkingSteps((prev) => [
                            ...prev,
                            { id: Date.now().toString(), role: 'slave', type: 'slave_response', content: step.content, provider: step.provider, question: step.question },
                        ]);
                    } else if (step.type === 'final') {
                        if (!finalStarted) {
                            finalStarted = true;
                            setMessages((prev) => [
                                ...prev,
                                { id: finalMsgId, role: 'master', type: 'final', content: step.content, provider: masterProvider },
                            ]);
                        } else {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === finalMsgId ? { ...m, content: m.content + step.content } : m
                                )
                            );
                        }
                    }
                } catch { }
            }
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function startNewChat() {
        setMessages([]);
        setThinkingSteps([]);
        setConversationId(null);
        setTokenStats({ totalTokens: 0, contextMessages: 0, inputTokens: 0, outputTokens: 0 });
        // Update URL without reload
        window.history.pushState({}, '', '/chat');
    }

    const activeConns = connections.filter((c) => c.isActive);

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Config panel */}
            {showPanel && (
                <div
                    style={{
                        width: 280,
                        borderRight: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--bg-secondary)',
                        flexShrink: 0,
                    }}
                >
                    <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)', overflowY: 'auto' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, fontFamily: 'Space Grotesk, sans-serif' }}>
                            Chat Configuration
                        </div>

                        {/* Mode toggle */}
                        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 8, padding: 3, marginBottom: 16 }}>
                            {(['DIRECT', 'ORCHESTRATED'] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    style={{
                                        flex: 1,
                                        padding: '7px 4px',
                                        borderRadius: 6,
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.72rem',
                                        background: mode === m ? 'linear-gradient(135deg, #7c5cfc, #3b82f6)' : 'transparent',
                                        color: mode === m ? 'white' : 'var(--text-muted)',
                                        fontFamily: 'Inter, sans-serif',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {m === 'DIRECT' ? '⚡ Direct' : '🧠 Orchestrate'}
                                </button>
                            ))}
                        </div>

                        {/* Direct mode: pick AI */}
                        {mode === 'DIRECT' && (
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    AI Provider
                                </div>
                                {activeConns.map((conn) => {
                                    const color = PROVIDER_COLORS[conn.provider as AIProvider] || '#7c5cfc';
                                    const active = selectedProvider === conn.provider;
                                    return (
                                        <button
                                            key={conn.provider}
                                            onClick={() => setSelectedProvider(conn.provider)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: active ? `1px solid ${color}` : '1px solid var(--border)',
                                                background: active ? `${color}15` : 'var(--bg-card)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                marginBottom: 6,
                                                color: active ? color : 'var(--text-secondary)',
                                                fontFamily: 'Inter, sans-serif',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>{PROVIDER_ICONS[conn.provider]}</span>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{PROVIDER_LABELS[conn.provider as AIProvider]}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{conn.model}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Orchestrated mode */}
                        {mode === 'ORCHESTRATED' && (
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Master AI (leads)
                                </div>
                                {activeConns.map((conn) => {
                                    const color = PROVIDER_COLORS[conn.provider as AIProvider] || '#7c5cfc';
                                    const active = masterProvider === conn.provider;
                                    return (
                                        <button
                                            key={conn.provider}
                                            onClick={() => setMasterProvider(conn.provider)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                                                background: active ? `${color}15` : 'var(--bg-card)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                marginBottom: 6,
                                                color: active ? color : 'var(--text-secondary)',
                                                fontFamily: 'Inter, sans-serif',
                                                transition: 'all 0.15s ease',
                                                position: 'relative',
                                            }}
                                        >
                                            {active && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        top: -6,
                                                        right: 8,
                                                        background: color,
                                                        color: 'white',
                                                        fontSize: '0.55rem',
                                                        padding: '1px 6px',
                                                        borderRadius: 6,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    MASTER
                                                </span>
                                            )}
                                            <span style={{ fontSize: '1.1rem' }}>{PROVIDER_ICONS[conn.provider]}</span>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{PROVIDER_LABELS[conn.provider as AIProvider]}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{conn.model}</div>
                                            </div>
                                        </button>
                                    );
                                })}

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 14, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Slave AIs (assist)
                                </div>
                                {activeConns
                                    .filter((c) => c.provider !== masterProvider)
                                    .map((conn) => {
                                        const color = PROVIDER_COLORS[conn.provider as AIProvider] || '#10b981';
                                        const active = slaveProviders.includes(conn.provider);
                                        return (
                                            <button
                                                key={conn.provider}
                                                onClick={() =>
                                                    setSlaveProviders((prev) =>
                                                        prev.includes(conn.provider)
                                                            ? prev.filter((p) => p !== conn.provider)
                                                            : [...prev, conn.provider]
                                                    )
                                                }
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: 8,
                                                    border: active ? `2px solid ${color}` : '1px solid var(--border)',
                                                    background: active ? `${color}15` : 'var(--bg-card)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginBottom: 6,
                                                    color: active ? color : 'var(--text-secondary)',
                                                    fontFamily: 'Inter, sans-serif',
                                                    transition: 'all 0.15s ease',
                                                    position: 'relative',
                                                }}
                                            >
                                                {active && (
                                                    <span
                                                        style={{
                                                            position: 'absolute',
                                                            top: -6,
                                                            right: 8,
                                                            background: color,
                                                            color: 'white',
                                                            fontSize: '0.55rem',
                                                            padding: '1px 6px',
                                                            borderRadius: 6,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        SLAVE ✓
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '1.1rem' }}>{PROVIDER_ICONS[conn.provider]}</span>
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{PROVIDER_LABELS[conn.provider as AIProvider]}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{conn.model}</div>
                                                </div>
                                            </button>
                                        );
                                    })}

                                {activeConns.length < 2 && (
                                    <div
                                        style={{
                                            background: 'rgba(245,158,11,0.1)',
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            borderRadius: 8,
                                            padding: '10px 12px',
                                            color: '#f59e0b',
                                            fontSize: '0.78rem',
                                            marginTop: 8,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        ⚠️ You need at least 2 connected AIs for orchestration mode.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Token Stats Panel */}
                        {messages.length > 0 && (
                            <div
                                style={{
                                    marginTop: 20,
                                    paddingTop: 16,
                                    borderTop: '1px solid var(--border)',
                                }}
                            >
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                                    📊 Context Stats
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    {[
                                        { label: 'Total Tokens', value: tokenStats.totalTokens.toLocaleString(), color: '#7c5cfc' },
                                        { label: 'Context Msgs', value: tokenStats.contextMessages.toString(), color: '#3b82f6' },
                                        { label: 'Input Tokens', value: tokenStats.inputTokens.toLocaleString(), color: '#10b981' },
                                        { label: 'Output Tokens', value: tokenStats.outputTokens.toLocaleString(), color: '#f59e0b' },
                                    ].map(({ label, value, color }) => (
                                        <div
                                            key={label}
                                            style={{
                                                background: `${color}0d`,
                                                border: `1px solid ${color}20`,
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color, fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                                    * Estimated (~4 chars/token). Actual usage may vary by provider.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Orchestration steps (inner panel) */}
                    {mode === 'ORCHESTRATED' && thinkingSteps.length > 0 && (
                        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                                🔍 Orchestration Log
                            </div>
                            {thinkingSteps.map((step) => (
                                <div
                                    key={step.id}
                                    className="fade-in-up"
                                    style={{ marginBottom: 10 }}
                                >
                                    {step.type === 'thinking' && (
                                        <div
                                            style={{
                                                background: `${PROVIDER_COLORS[step.provider as AIProvider] || '#7c5cfc'}10`,
                                                border: `1px solid ${PROVIDER_COLORS[step.provider as AIProvider] || '#7c5cfc'}25`,
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                                                {PROVIDER_ICONS[step.provider || '']} {step.provider} thinking
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {step.content.slice(0, 200)}{step.content.length > 200 ? '...' : ''}
                                            </div>
                                        </div>
                                    )}
                                    {step.type === 'delegation' && (
                                        <div
                                            style={{
                                                background: 'rgba(124,92,252,0.08)',
                                                border: '1px solid rgba(124,92,252,0.2)',
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.68rem', color: '#a78bfa', fontWeight: 600, marginBottom: 3 }}>
                                                → Delegating to {step.delegateTo}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{step.question}</div>
                                        </div>
                                    )}
                                    {step.type === 'slave_response' && (
                                        <div
                                            style={{
                                                background: 'rgba(16,185,129,0.06)',
                                                border: '1px solid rgba(16,185,129,0.2)',
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, marginBottom: 3 }}>
                                                {PROVIDER_ICONS[step.provider || '']} {step.provider} responded
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxHeight: 60, overflow: 'hidden' }}>
                                                {step.content.slice(0, 150)}{step.content.length > 150 ? '...' : ''}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main chat area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Toolbar */}
                <div
                    style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'var(--bg-secondary)',
                    }}
                >
                    <button
                        onClick={() => setShowPanel(!showPanel)}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '6px 10px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        {showPanel ? '◀' : '▶'}
                    </button>

                    <div style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>
                        {loadingHistory ? (
                            <span style={{ color: 'var(--text-muted)' }}>⏳ Loading conversation...</span>
                        ) : mode === 'DIRECT' ? (
                            <span>
                                {PROVIDER_ICONS[selectedProvider]} Direct Chat with{' '}
                                {PROVIDER_LABELS[selectedProvider as AIProvider] || selectedProvider}
                            </span>
                        ) : (
                            <span>
                                🧠 Orchestrated: {PROVIDER_ICONS[masterProvider]}{' '}
                                {PROVIDER_LABELS[masterProvider as AIProvider] || masterProvider} (Master) +{' '}
                                {slaveProviders.map((p) => `${PROVIDER_ICONS[p]} ${p}`).join(', ')} (Slave)
                            </span>
                        )}
                    </div>

                    {/* Token summary in toolbar */}
                    {messages.length > 0 && (
                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '5px 10px',
                            }}
                        >
                            <span>🪙 <strong style={{ color: '#7c5cfc' }}>{tokenStats.totalTokens.toLocaleString()}</strong> tokens</span>
                            <span style={{ color: 'var(--border)' }}>|</span>
                            <span>📨 <strong style={{ color: '#3b82f6' }}>{tokenStats.contextMessages}</strong> msgs</span>
                        </div>
                    )}

                    <button
                        onClick={startNewChat}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        New Chat
                    </button>
                </div>

                {/* Messages */}
                <div className="chat-messages" style={{ flex: 1, background: 'var(--bg-primary)' }}>
                    {loadingHistory ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="shimmer" style={{ height: 60, borderRadius: 12 }} />
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 20 }}>
                                {mode === 'DIRECT' ? '💬' : '🧠'}
                            </div>
                            <h2
                                style={{
                                    fontFamily: 'Space Grotesk, sans-serif',
                                    fontSize: '1.3rem',
                                    fontWeight: 700,
                                    marginBottom: 8,
                                }}
                            >
                                {mode === 'DIRECT' ? 'Direct Chat' : 'Orchestrated Chat'}
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                                {mode === 'DIRECT'
                                    ? `Chatting directly with ${PROVIDER_LABELS[selectedProvider as AIProvider] || selectedProvider}. Type a message to begin.`
                                    : `${PROVIDER_LABELS[masterProvider as AIProvider] || masterProvider} will lead as Master. Slave AIs will assist with sub-tasks. Ask anything complex!`}
                            </p>
                            {mode === 'ORCHESTRATED' && (
                                <div
                                    style={{
                                        marginTop: 20,
                                        background: 'rgba(124,92,252,0.05)',
                                        border: '1px solid rgba(124,92,252,0.2)',
                                        borderRadius: 12,
                                        padding: '14px 20px',
                                        display: 'inline-block',
                                        textAlign: 'left',
                                        maxWidth: 400,
                                    }}
                                >
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                        💡 Try asking:
                                    </div>
                                    {[
                                        '"Explain quantum entanglement and give Python code to simulate it"',
                                        '"Compare GPT-4 and Gemini, then write a marketing plan for an AI startup"',
                                        '"Write a research summary on climate change with actionable recommendations"',
                                    ].map((s) => (
                                        <div
                                            key={s}
                                            onClick={() => setInput(s.replace(/"/g, ''))}
                                            style={{
                                                fontSize: '0.8rem',
                                                color: '#a78bfa',
                                                cursor: 'pointer',
                                                marginBottom: 4,
                                                padding: '4px 0',
                                            }}
                                        >
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className="fade-in-up">
                                {msg.role === 'user' ? (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <div className="bubble-user">{msg.content}</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    color: PROVIDER_COLORS[msg.provider as AIProvider] || '#7c5cfc',
                                                    fontSize: '1rem',
                                                }}
                                            >
                                                {PROVIDER_ICONS[msg.provider || '']}
                                            </span>
                                            {PROVIDER_LABELS[msg.provider as AIProvider] || msg.provider}
                                            {msg.role === 'master' && mode === 'ORCHESTRATED' && (
                                                <span
                                                    style={{
                                                        background: 'rgba(124,92,252,0.15)',
                                                        color: '#a78bfa',
                                                        fontSize: '0.62rem',
                                                        padding: '1px 6px',
                                                        borderRadius: 4,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    MASTER
                                                </span>
                                            )}
                                            {/* Per-message token count */}
                                            <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.65rem' }}>
                                                ~{estimateTokens(msg.content).toLocaleString()} tokens
                                            </span>
                                        </div>
                                        <div className="bubble-master" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                            {msg.content}
                                            {streaming && msg.id === messages[messages.length - 1]?.id && (
                                                <span className="typing-cursor" />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {streaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <div className="fade-in-up">
                            <div className="loading-dots" style={{ padding: '8px 0' }}>
                                <span /><span /><span />
                            </div>
                        </div>
                    )}

                    {orchestrationError && (
                        <div className="fade-in-up" style={{ padding: '0 20px 16px' }}>
                            <div
                                style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    color: '#f87171',
                                    fontSize: '0.85rem',
                                    lineHeight: 1.5,
                                }}
                            >
                                <strong>⚠️ Orchestration Error:</strong> {orchestrationError}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div
                    style={{
                        padding: '16px 20px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-bright)',
                            borderRadius: 14,
                            padding: '8px 8px 8px 16px',
                            transition: 'border-color 0.2s ease',
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                mode === 'DIRECT'
                                    ? `Message ${PROVIDER_LABELS[selectedProvider as AIProvider] || selectedProvider}...`
                                    : 'Ask something complex — your AIs will collaborate to answer...'
                            }
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                resize: 'none',
                                minHeight: 44,
                                maxHeight: 160,
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: 1.6,
                                paddingTop: 10,
                            }}
                            rows={1}
                            disabled={streaming}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={streaming || !input.trim()}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                border: 'none',
                                background: streaming || !input.trim()
                                    ? 'var(--border)'
                                    : 'linear-gradient(135deg, #7c5cfc, #3b82f6)',
                                color: 'white',
                                cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                flexShrink: 0,
                                transition: 'all 0.2s ease',
                                alignSelf: 'flex-end',
                            }}
                        >
                            {streaming ? '⏳' : '↑'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Enter to send · Shift+Enter for new line · API keys encrypted with AES-256</span>
                        {input.length > 0 && (
                            <span>~{estimateTokens(input)} tokens in input</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense>
            <ChatContent />
        </Suspense>
    );
}
