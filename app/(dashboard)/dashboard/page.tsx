'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PROVIDER_LABELS, PROVIDER_COLORS } from '@/lib/ai/registry';

interface AIConnection {
    id: string;
    provider: string;
    model: string;
    isActive: boolean;
    label: string | null;
    createdAt: string;
}

interface Conversation {
    id: string;
    title: string;
    mode: string;
    updatedAt: string;
    messages: { content: string }[];
    orchestrationConfig?: { masterProvider: string; slaveProviders: string } | null;
}

export default function DashboardPage() {
    const { data: session } = useSession();
    const [connections, setConnections] = useState<AIConnection[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [connRes, convRes] = await Promise.all([
                fetch('/api/connections'),
                fetch('/api/conversations'),
            ]);
            if (connRes.ok) setConnections(await connRes.json());
            if (convRes.ok) setConversations(await convRes.json());
            setLoading(false);
        }
        load();
    }, []);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div style={{ padding: '36px 40px', maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
                <h1
                    style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        marginBottom: 6,
                    }}
                >
                    {greeting},{' '}
                    <span className="gradient-text">{session?.user?.name || 'there'}</span> 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Your AI Orchestration Hub overview
                </p>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
                {[
                    { label: 'Connected AIs', value: connections.length, icon: '🔗', color: '#7c5cfc' },
                    { label: 'Active AIs', value: connections.filter((c) => c.isActive).length, icon: '✅', color: '#10b981' },
                    { label: 'Conversations', value: conversations.length, icon: '💬', color: '#3b82f6' },
                ].map((stat) => (
                    <div key={stat.label} className="glass-card" style={{ padding: '22px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: '1.4rem' }}>{stat.icon}</span>
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: stat.color,
                                    boxShadow: `0 0 8px ${stat.color}`,
                                }}
                            />
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: stat.color }}>
                            {loading ? '—' : stat.value}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                {/* Connected AIs */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem' }}>
                            Connected AIs
                        </h2>
                        <Link href="/connect" style={{ color: 'var(--accent-purple)', fontSize: '0.82rem', textDecoration: 'none' }}>
                            + Add AI
                        </Link>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[1, 2].map((i) => (
                                <div key={i} className="shimmer" style={{ height: 72 }} />
                            ))}
                        </div>
                    ) : connections.length === 0 ? (
                        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                                No AIs connected yet
                            </p>
                            <Link href="/connect">
                                <button className="btn-primary">
                                    <span>Connect your first AI</span>
                                </button>
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {connections.map((conn) => {
                                const color = PROVIDER_COLORS[conn.provider as keyof typeof PROVIDER_COLORS] || '#7c5cfc';
                                const label = PROVIDER_LABELS[conn.provider as keyof typeof PROVIDER_LABELS] || conn.provider;
                                return (
                                    <div
                                        key={conn.id}
                                        className="glass-card glass-card-hover"
                                        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
                                    >
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
                                                fontSize: '1.2rem',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {conn.provider === 'OPENAI' ? '◎' : '✦'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{conn.model}</div>
                                        </div>
                                        <div
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: conn.isActive ? '#10b981' : '#ef4444',
                                                flexShrink: 0,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent conversations */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem' }}>
                            Recent Conversations
                        </h2>
                        <Link href="/chat" style={{ color: 'var(--accent-purple)', fontSize: '0.82rem', textDecoration: 'none' }}>
                            + New Chat
                        </Link>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[1, 2, 3].map((i) => <div key={i} className="shimmer" style={{ height: 68 }} />)}
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                                No conversations yet
                            </p>
                            <Link href="/chat">
                                <button className="btn-primary"><span>Start chatting</span></button>
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {conversations.slice(0, 6).map((conv) => (
                                <Link
                                    key={conv.id}
                                    href={`/chat?id=${conv.id}`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div className="glass-card glass-card-hover" style={{ padding: '14px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: '1rem' }}>{conv.mode === 'ORCHESTRATED' ? '🧠' : '💬'}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontWeight: 500,
                                                        fontSize: '0.88rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {conv.title}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                                                    {conv.mode === 'ORCHESTRATED' ? '🔀 Orchestrated' : '⚡ Direct'} ·{' '}
                                                    {new Date(conv.updatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick actions */}
            {connections.length >= 2 && (
                <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>
                        Quick Actions
                    </h2>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Link href="/chat?mode=ORCHESTRATED">
                            <button className="btn-primary" style={{ padding: '12px 24px' }}>
                                <span>🧠 Start Orchestrated Chat</span>
                            </button>
                        </Link>
                        <Link href="/chat">
                            <button className="btn-secondary" style={{ padding: '12px 24px' }}>
                                💬 Direct Chat
                            </button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
