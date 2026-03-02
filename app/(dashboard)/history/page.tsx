'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Conversation {
    id: string;
    title: string;
    mode: string;
    updatedAt: string;
    messages: { content: string; role: string }[];
    orchestrationConfig?: { masterProvider: string; slaveProviders: string } | null;
}

export default function HistoryPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/conversations')
            .then((r) => r.json())
            .then((data) => {
                setConversations(data);
                setLoading(false);
            });
    }, []);

    return (
        <div style={{ padding: '36px 40px', maxWidth: 800 }}>
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
                    Chat <span className="gradient-text">History</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Browse your previous AI conversations
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="shimmer" style={{ height: 80 }} />
                    ))}
                </div>
            ) : conversations.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 20 }}>🕐</div>
                    <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 12 }}>
                        No conversations yet
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        Start your first AI conversation to see it here.
                    </p>
                    <Link href="/chat">
                        <button className="btn-primary"><span>Start Chatting</span></button>
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {conversations.map((conv) => {
                        const slaves = conv.orchestrationConfig
                            ? JSON.parse(conv.orchestrationConfig.slaveProviders || '[]')
                            : [];
                        return (
                            <Link key={conv.id} href={`/chat?id=${conv.id}`} style={{ textDecoration: 'none' }}>
                                <div className="glass-card glass-card-hover" style={{ padding: '18px 22px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                background: conv.mode === 'ORCHESTRATED'
                                                    ? 'rgba(124,92,252,0.15)'
                                                    : 'rgba(59,130,246,0.15)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.4rem',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {conv.mode === 'ORCHESTRATED' ? '🧠' : '💬'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    fontSize: '0.92rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {conv.title}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span
                                                    style={{
                                                        fontSize: '0.72rem',
                                                        padding: '2px 8px',
                                                        borderRadius: 10,
                                                        fontWeight: 600,
                                                        background: conv.mode === 'ORCHESTRATED'
                                                            ? 'rgba(124,92,252,0.15)'
                                                            : 'rgba(59,130,246,0.15)',
                                                        color: conv.mode === 'ORCHESTRATED' ? '#a78bfa' : '#60a5fa',
                                                    }}
                                                >
                                                    {conv.mode === 'ORCHESTRATED'
                                                        ? `🔀 ${conv.orchestrationConfig?.masterProvider || ''} → ${slaves.join(', ')}`
                                                        : '⚡ Direct'}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                    {new Date(conv.updatedAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>→</div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
