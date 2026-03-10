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
    totalTokens?: number;
    messageCount?: number;
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
                <div className="glass-card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
                                <div className="glass-card glass-card-hover" style={{ padding: '18px 22px', background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                background: conv.mode === 'ORCHESTRATED'
                                                    ? 'color-mix(in srgb, var(--accent-purple) 15%, transparent)'
                                                    : 'color-mix(in srgb, var(--accent-blue) 15%, transparent)',
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
                                                            ? 'color-mix(in srgb, var(--accent-purple) 15%, transparent)'
                                                            : 'color-mix(in srgb, var(--accent-blue) 15%, transparent)',
                                                        color: conv.mode === 'ORCHESTRATED' ? 'var(--accent-purple)' : 'var(--accent-blue)',
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, opacity: 0.85 }}>
                                                {conv.totalTokens !== undefined && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                                {conv.totalTokens >= 1000 ? `${(conv.totalTokens / 1000).toFixed(1)}k` : conv.totalTokens} tokens
                                                            </span>
                                                            {conv.messageCount !== undefined && (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                                                    {conv.messageCount} messages
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Token infographic bar */}
                                                        <div 
                                                            style={{ 
                                                                width: 32, 
                                                                height: 6, 
                                                                background: 'color-mix(in srgb, var(--text-muted) 20%, transparent)', 
                                                                borderRadius: 4,
                                                                overflow: 'hidden',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            <div 
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0, left: 0, bottom: 0,
                                                                    width: `${Math.min(100, (conv.totalTokens / 32000) * 100)}%`,
                                                                    background: conv.mode === 'ORCHESTRATED' ? 'var(--accent-purple)' : 'var(--accent-blue)',
                                                                    borderRadius: 4
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', opacity: 0.5, marginLeft: 8 }}>→</div>
                                        </div>
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
