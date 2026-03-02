'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/connect', label: 'Connect AIs', icon: '🔗' },
    { href: '/chat', label: 'New Chat', icon: '💬' },
    { href: '/history', label: 'History', icon: '🕐' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();

    return (
        <div className="sidebar">
            {/* Logo */}
            <div
                style={{
                    padding: '24px 20px 16px',
                    borderBottom: '1px solid var(--border)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #7c5cfc, #3b82f6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 700,
                            flexShrink: 0,
                        }}
                    >
                        H
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            HeliosPrimer
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI Hub</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '16px 12px' }}>
                <div style={{ marginBottom: 8, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, padding: '0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Navigation
                </div>
                {NAV_ITEMS.map((item) => {
                    const active = pathname === item.href || (item.href === '/chat' && pathname.startsWith('/chat'));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 10,
                                textDecoration: 'none',
                                color: active ? 'white' : 'var(--text-secondary)',
                                background: active ? 'linear-gradient(135deg, rgba(124,92,252,0.3), rgba(59,130,246,0.2))' : 'transparent',
                                border: active ? '1px solid rgba(124,92,252,0.3)' : '1px solid transparent',
                                fontSize: '0.88rem',
                                fontWeight: active ? 600 : 400,
                                marginBottom: 4,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User section */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                <div
                    style={{
                        background: 'var(--bg-card)',
                        borderRadius: 12,
                        padding: '12px',
                        marginBottom: 8,
                    }}
                >
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        Signed in as
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, wordBreak: 'break-all' }}>
                        {session?.user?.name || session?.user?.email}
                    </div>
                </div>
                <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '9px', fontSize: '0.82rem' }}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
