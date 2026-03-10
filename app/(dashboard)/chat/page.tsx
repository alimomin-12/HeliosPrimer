'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider } from '@/lib/ai/registry';
import { extractArtifacts, downloadAsFile, downloadAsPdf, type Artifact } from '@/lib/artifacts';
import { renderMarkdownText } from '@/lib/markdownRenderer';

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

const PROVIDER_ICONS: Record<string, string> = { OPENAI: '◎', GEMINI: '✦', QWEN: '⬡', DEEPSEEK: '🐋' };

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
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [activeTab, setActiveTab] = useState<'chat' | 'artifacts'>('chat');
    const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null);
    const [streamingDone, setStreamingDone] = useState(false);
    const [outputLayout, setOutputLayout] = useState<'structured' | 'casual'>(() => {
        if (typeof localStorage !== 'undefined') {
            return (localStorage.getItem('heliosprimer-output-layout') as 'structured' | 'casual') || 'structured';
        }
        return 'structured';
    });
    const [researchMode, setResearchMode] = useState<boolean>(() => {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('heliosprimer-research-mode') === 'true';
        }
        return false;
    });
    const [showThinkingLogs, setShowThinkingLogs] = useState(false);
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

    // Auto-extract artifacts when streaming completes
    useEffect(() => {
        if (!streamingDone) return;
        setStreamingDone(false);
        // Get the last master message (the most recent AI response)
        const lastMaster = [...messages].reverse().find((m) => m.role === 'master' && m.type === 'final');
        if (!lastMaster || !lastMaster.content) return;
        const found = extractArtifacts(lastMaster.id, lastMaster.content);
        if (found.length === 0) return;
        setArtifacts((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            return [...prev, ...found.filter((a) => !existingIds.has(a.id))];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamingDone]);

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

            // Extract artifacts from all AI messages in the loaded conversation
            const historyArtifacts: Artifact[] = [];
            const seenIds = new Set<string>();
            for (const m of loaded) {
                if (m.role !== 'user' && m.content) {
                    const found = extractArtifacts(m.id, m.content);
                    for (const a of found) {
                        if (!seenIds.has(a.id)) {
                            seenIds.add(a.id);
                            historyArtifacts.push(a);
                        }
                    }
                }
            }
            if (historyArtifacts.length > 0) setArtifacts(historyArtifacts);

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
        setStreamingDone(true);
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
                researchMode,
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
                            { id: nextStepId(), role: 'slave', type: 'slave_response', content: step.content, provider: step.provider, question: step.question },
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
        setArtifacts([]);
        setActiveTab('chat');
        setOrchestrationError(null);
        // Update URL without reload
        window.history.pushState({}, '', '/chat');
    }

    // ─── ArtifactPanel ───────────────────────────────────────────────────────
    function ArtifactPanel() {
        if (artifacts.length === 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>No artifacts yet</div>
                    <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                        Code blocks, scripts, and documents generated by AI will appear here for download.
                    </div>
                </div>
            );
        }

        return (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, overflowY: 'auto', height: '100%', alignContent: 'start' }}>
                {artifacts.map((a) => (
                    <div
                        key={a.id}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'border-color 0.15s ease',
                        }}
                    >
                        {/* Card header */}
                        <div
                            style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                cursor: 'pointer',
                                background: 'var(--bg-secondary)',
                            }}
                            onClick={() => setExpandedArtifact(expandedArtifact === a.id ? null : a.id)}
                        >
                            <span style={{ fontSize: '1.1rem' }}>{a.type === 'code' ? '💻' : '📄'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    <span style={{ background: 'rgba(124,92,252,0.12)', color: '#7c5cfc', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{a.language}</span>
                                    <span style={{ marginLeft: 8 }}>{a.content.split('\n').length} lines</span>
                                    <span style={{ marginLeft: 8 }}>·</span>
                                    <span style={{ marginLeft: 8 }}>{new Date(a.createdAt).toLocaleTimeString()}</span>
                                </div>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{expandedArtifact === a.id ? '▲' : '▼'}</span>
                        </div>

                        {/* Expanded preview */}
                        {expandedArtifact === a.id && (
                            <pre
                                style={{
                                    margin: 0,
                                    padding: 14,
                                    fontSize: '0.72rem',
                                    lineHeight: 1.6,
                                    overflowX: 'auto',
                                    maxHeight: 280,
                                    overflowY: 'auto',
                                    background: '#0d0d1a',
                                    color: '#e2e8f0',
                                    fontFamily: "'Courier New', Courier, monospace",
                                    borderRadius: 0,
                                }}
                            >
                                <code>{a.content}</code>
                            </pre>
                        )}

                        {/* Download buttons */}
                        <div style={{ padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <button
                                onClick={() => downloadAsFile(`${a.title.replace(/\s+/g, '_')}.${a.extension}`, a.content)}
                                style={{
                                    padding: '5px 12px', fontSize: '0.72rem', borderRadius: 6, border: '1px solid var(--border)',
                                    background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                                    transition: 'all 0.15s',
                                }}
                            >
                                ⬇ .{a.extension}
                            </button>
                            <button
                                onClick={() => downloadAsFile(`${a.title.replace(/\s+/g, '_')}.md`, `# ${a.title}\n\n\`\`\`${a.language}\n${a.content}\n\`\`\``)}
                                style={{
                                    padding: '5px 12px', fontSize: '0.72rem', borderRadius: 6, border: '1px solid var(--border)',
                                    background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                ⬇ .md
                            </button>
                            <button
                                onClick={() => downloadAsPdf(a)}
                                style={{
                                    padding: '5px 12px', fontSize: '0.72rem', borderRadius: 6, border: '1px solid rgba(124,92,252,0.4)',
                                    background: 'rgba(124,92,252,0.08)', color: '#7c5cfc', cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                ⬇ PDF
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
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
                                    onClick={() => {
                                        setMode(m);
                                        if (m === 'DIRECT' && researchMode) {
                                            setResearchMode(false);
                                            localStorage.setItem('heliosprimer-research-mode', 'false');
                                        }
                                    }}
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

                        {/* Research Mode Toggle */}
                        <div style={{
                            marginTop: 16,
                            borderRadius: 10,
                            border: researchMode
                                ? '1.5px solid rgba(16,185,129,0.5)'
                                : '1px solid var(--border)',
                            background: researchMode
                                ? 'rgba(16,185,129,0.07)'
                                : 'var(--bg-card)',
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                        }}>
                            <button
                                onClick={() => {
                                    const next = !researchMode;
                                    setResearchMode(next);
                                    localStorage.setItem('heliosprimer-research-mode', String(next));
                                    if (next) setMode('ORCHESTRATED');
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '12px 14px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                {/* Toggle pill */}
                                <div style={{
                                    width: 38, height: 20, borderRadius: 10, flexShrink: 0,
                                    background: researchMode ? '#10b981' : 'var(--border-bright)',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: 3, left: researchMode ? 20 : 3,
                                        width: 14, height: 14, borderRadius: '50%',
                                        background: 'white',
                                        transition: 'left 0.2s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.84rem',
                                        fontWeight: 700,
                                        color: researchMode ? '#10b981' : 'var(--text-primary)',
                                        fontFamily: 'Space Grotesk, sans-serif',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                    }}>
                                        🔬 Research Mode
                                        {researchMode && (
                                            <span style={{
                                                fontSize: '0.6rem', background: '#10b981',
                                                color: 'white', borderRadius: 4, padding: '1px 6px', fontWeight: 700,
                                            }}>ACTIVE</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                                        {researchMode
                                            ? 'Multi-agent research with citations & structured document output'
                                            : 'Enable for fact-based, cited research reports'}
                                    </div>
                                </div>
                            </button>
                            {researchMode && (
                                <div style={{
                                    padding: '0 14px 12px',
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                }}>
                                    {[
                                        '📋 Master AI creates a research plan',
                                        '🔍 Specialist agents gather cited facts',
                                        '📄 Synthesised into a professional document',
                                    ].map((item) => (
                                        <div key={item} style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

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

                    <div style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                                {PROVIDER_LABELS[masterProvider as AIProvider] || masterProvider}
                            </span>
                        )}

                        {mode === 'ORCHESTRATED' && thinkingSteps.length > 0 && (
                            <button
                                onClick={() => setShowThinkingLogs(!showThinkingLogs)}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '0.7rem',
                                    borderRadius: 6,
                                    border: showThinkingLogs ? '1px solid #7c5cfc' : '1px solid var(--border)',
                                    background: showThinkingLogs ? 'rgba(124,92,252,0.15)' : 'var(--bg-card)',
                                    color: showThinkingLogs ? '#7c5cfc' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                🔍 Orchestration Logs
                                <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>{thinkingSteps.length}</span>
                            </button>
                        )}
                    </div>

                    {/* Artifacts tab button */}
                    {artifacts.length > 0 && (
                        <button
                            onClick={() => setActiveTab(activeTab === 'artifacts' ? 'chat' : 'artifacts')}
                            style={{
                                padding: '5px 12px',
                                fontSize: '0.72rem',
                                borderRadius: 8,
                                border: activeTab === 'artifacts' ? '1px solid #7c5cfc' : '1px solid var(--border)',
                                background: activeTab === 'artifacts' ? 'rgba(124,92,252,0.12)' : 'var(--bg-card)',
                                color: activeTab === 'artifacts' ? '#7c5cfc' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            📦 Artifacts
                            <span style={{
                                background: '#7c5cfc',
                                color: 'white',
                                borderRadius: 10,
                                padding: '1px 6px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                minWidth: 16,
                                textAlign: 'center',
                            }}
                            >{artifacts.length}</span>
                        </button>
                    )}

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

                    {/* Output layout toggle */}
                    <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {(['structured', 'casual'] as const).map((mode_) => (
                            <button
                                key={mode_}
                                onClick={() => {
                                    setOutputLayout(mode_);
                                    localStorage.setItem('heliosprimer-output-layout', mode_);
                                }}
                                title={mode_ === 'structured' ? 'Structured: renders markdown with headings, lists, and formatting' : 'Casual: plain conversational text'}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.7rem',
                                    border: 'none',
                                    background: outputLayout === mode_ ? 'var(--accent-purple)' : 'var(--bg-card)',
                                    color: outputLayout === mode_ ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {mode_ === 'structured' ? '⊞ Structured' : '✎ Casual'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={startNewChat}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        New Chat
                    </button>
                </div>

                {/* Chat or Artifacts panel */}
                <div className="chat-messages" style={{ flex: 1, background: 'var(--bg-primary)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {activeTab === 'artifacts' ? (
                        <ArtifactPanel />
                    ) : (
                        <>
                            {/* Orchestration Logs Overlay */}
                            {mode === 'ORCHESTRATED' && showThinkingLogs && (
                                <div
                                    className="fade-in"
                                    style={{
                                        position: 'absolute',
                                        top: 14,
                                        right: 20,
                                        width: 380,
                                        maxHeight: 'calc(100% - 40px)',
                                        background: 'rgba(15, 15, 20, 0.75)',
                                        backdropFilter: 'blur(20px) saturate(180%)',
                                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: 20,
                                        zIndex: 100,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(124,92,252,0.1)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(124,92,252,0.05)' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1rem' }}>🔍</span> Orchestration Logs
                                        </div>
                                        <button
                                            onClick={() => setShowThinkingLogs(false)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: 28,
                                                height: 28,
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {thinkingSteps.map((step, idx) => (
                                            <div
                                                key={step.id}
                                                className="fade-in-up"
                                                style={{ animationDelay: `${idx * 0.05}s` }}
                                            >
                                                {step.type === 'thinking' && (
                                                    <div
                                                        style={{
                                                            background: `${PROVIDER_COLORS[step.provider as AIProvider] || '#7c5cfc'}10`,
                                                            border: `1px solid ${PROVIDER_COLORS[step.provider as AIProvider] || '#7c5cfc'}25`,
                                                            borderRadius: 12,
                                                            padding: '12px 14px',
                                                        }}
                                                    >
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {PROVIDER_ICONS[step.provider || '']} {step.provider} <span style={{ opacity: 0.5, fontWeight: 400 }}>is thinking</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}>
                                                            {step.content}
                                                        </div>
                                                    </div>
                                                )}
                                                {step.type === 'delegation' && (
                                                    <div
                                                        style={{
                                                            background: 'rgba(124,92,252,0.1)',
                                                            border: '1px solid rgba(124,92,252,0.3)',
                                                            borderRadius: 12,
                                                            padding: '12px 14px',
                                                        }}
                                                    >
                                                        <div style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                            → Delegation
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: 'white', fontWeight: 600, marginBottom: 6 }}>
                                                            Task for {step.delegateTo}:
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                                                            {step.question}
                                                        </div>
                                                    </div>
                                                )}
                                                {step.type === 'slave_response' && (
                                                    <div
                                                        style={{
                                                            background: 'rgba(16,185,129,0.08)',
                                                            border: '1px solid rgba(16,185,129,0.3)',
                                                            borderRadius: 12,
                                                            padding: '12px 14px',
                                                        }}
                                                    >
                                                        <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {PROVIDER_ICONS[step.provider || '']} {step.provider} <span style={{ opacity: 0.5, fontWeight: 400 }}>responded</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                                                            {step.content}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        {thinkingSteps.length} orchestration events recorded
                                    </div>
                                </div>
                            )}

                            {/* Messages scroll area */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
                                {loadingHistory ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                                    <div className="bubble-master" style={{ lineHeight: 1.7 }}>
                                                        {(() => {
                                                            // Split content into text segments and code blocks
                                                            const CODE_SPLIT = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
                                                            const parts: React.ReactNode[] = [];
                                                            let lastIdx = 0;
                                                            let blockIdx = 0;
                                                            const src = msg.content;
                                                            let m: RegExpExecArray | null;
                                                            CODE_SPLIT.lastIndex = 0;
                                                            while ((m = CODE_SPLIT.exec(src)) !== null) {
                                                                // Text before this block
                                                                if (m.index > lastIdx) {
                                                                    const textSeg = src.slice(lastIdx, m.index);
                                                                    parts.push(
                                                                        <div key={`txt-${blockIdx}`}>
                                                                            {outputLayout === 'structured'
                                                                                ? renderMarkdownText(textSeg)
                                                                                : <span style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{textSeg}</span>
                                                                            }
                                                                        </div>
                                                                    );
                                                                }
                                                                const lang = (m[1] || 'plaintext').trim().toLowerCase() || 'plaintext';
                                                                const code = m[2].trim();
                                                                const LANG_EXT: Record<string, string> = {
                                                                    python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
                                                                    tsx: 'tsx', jsx: 'jsx', html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yml',
                                                                    bash: 'sh', shell: 'sh', sh: 'sh', sql: 'sql', rust: 'rs', go: 'go', java: 'java',
                                                                    cpp: 'cpp', c: 'c', cs: 'cs', ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt',
                                                                    dart: 'dart', markdown: 'md', md: 'md', xml: 'xml', plaintext: 'txt', text: 'txt',
                                                                };
                                                                const ext = LANG_EXT[lang] ?? lang ?? 'txt';
                                                                const LANG_LABELS: Record<string, string> = {
                                                                    python: 'Python Script', py: 'Python Script', javascript: 'JavaScript', js: 'JavaScript',
                                                                    typescript: 'TypeScript', ts: 'TypeScript', tsx: 'React Component', jsx: 'React Component',
                                                                    html: 'HTML Document', css: 'Stylesheet', json: 'JSON Data', yaml: 'YAML Config',
                                                                    bash: 'Shell Script', shell: 'Shell Script', sh: 'Shell Script', sql: 'SQL Query',
                                                                    rust: 'Rust Code', go: 'Go Code', java: 'Java Code', cpp: 'C++ Code', c: 'C Code',
                                                                    markdown: 'Markdown Doc', md: 'Markdown Doc',
                                                                };
                                                                const fileTitle = LANG_LABELS[lang] ?? (lang ? `${lang.toUpperCase()} File` : 'Text File');
                                                                const fileName = `${fileTitle.replace(/\s+/g, '_')}.${ext}`;
                                                                const lines = code.split('\n').length;
                                                                const cardKey = `code-${msg.id}-${blockIdx++}`;
                                                                parts.push(
                                                                    <div key={cardKey} style={{
                                                                        margin: '10px 0',
                                                                        border: '1px solid var(--border)',
                                                                        borderRadius: 10,
                                                                        overflow: 'hidden',
                                                                        background: 'var(--bg-secondary)',
                                                                    }}>
                                                                        {/* File header chip */}
                                                                        <div style={{
                                                                            display: 'flex', alignItems: 'center', gap: 10,
                                                                            padding: '8px 14px',
                                                                            background: 'var(--bg-card)',
                                                                            borderBottom: '1px solid var(--border)',
                                                                        }}>
                                                                            <span style={{ fontSize: '1rem' }}>💻</span>
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'Inter,sans-serif' }}>{fileTitle}</div>
                                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                                                                    <span style={{ background: 'rgba(124,92,252,0.12)', color: '#7c5cfc', borderRadius: 4, padding: '1px 5px', fontWeight: 700, fontSize: '0.65rem' }}>{lang}</span>
                                                                                    <span style={{ marginLeft: 8 }}>{lines} lines</span>
                                                                                </div>
                                                                            </div>
                                                                            {/* Download buttons */}
                                                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                                                <button
                                                                                    onClick={() => downloadAsFile(fileName, code)}
                                                                                    title={`Download ${fileName}`}
                                                                                    style={{
                                                                                        padding: '4px 10px', fontSize: '0.7rem', borderRadius: 6,
                                                                                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                                                                                        color: 'var(--text-primary)', cursor: 'pointer',
                                                                                        fontFamily: 'Inter,sans-serif', fontWeight: 600,
                                                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                                                        transition: 'all 0.15s',
                                                                                    }}
                                                                                >⬇ .{ext}</button>
                                                                                <button
                                                                                    onClick={() => downloadAsFile(`${fileTitle.replace(/\s+/g, '_')}.md`, `# ${fileTitle}\n\n\`\`\`${lang}\n${code}\n\`\`\``)}
                                                                                    title="Download as Markdown"
                                                                                    style={{
                                                                                        padding: '4px 10px', fontSize: '0.7rem', borderRadius: 6,
                                                                                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                                                                                        color: 'var(--text-primary)', cursor: 'pointer',
                                                                                        fontFamily: 'Inter,sans-serif', fontWeight: 600,
                                                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                                                    }}
                                                                                >⬇ .md</button>
                                                                            </div>
                                                                        </div>
                                                                        {/* Code preview */}
                                                                        <pre style={{
                                                                            margin: 0, padding: '12px 14px',
                                                                            fontSize: '0.72rem', lineHeight: 1.6,
                                                                            overflowX: 'auto', maxHeight: 220, overflowY: 'auto',
                                                                            background: '#0d0d1a', color: '#e2e8f0',
                                                                            fontFamily: "'Courier New',Courier,monospace",
                                                                        }}><code>{code}</code></pre>
                                                                    </div>
                                                                );
                                                                lastIdx = m.index + m[0].length;
                                                            }
                                                            // Remaining text after last block
                                                            if (lastIdx < src.length) {
                                                                const tailSeg = src.slice(lastIdx);
                                                                parts.push(
                                                                    <div key="txt-tail">
                                                                        {outputLayout === 'structured'
                                                                            ? renderMarkdownText(tailSeg)
                                                                            : <span style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{tailSeg}</span>
                                                                        }
                                                                    </div>
                                                                );
                                                            }
                                                            return parts.length > 0 ? parts : (
                                                                outputLayout === 'structured'
                                                                    ? renderMarkdownText(src)
                                                                    : <span style={{ whiteSpace: 'pre-wrap' }}>{src}</span>
                                                            );
                                                        })()}
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
                                    <div className="fade-in-up" style={{ padding: '0 0 16px' }}>
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
                        </>
                    )}
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
