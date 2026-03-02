'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'login' | 'register'>('login');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await signIn('credentials', {
            email,
            name: mode === 'register' ? name : undefined,
            redirect: false,
        });

        if (result?.error) {
            setError('Something went wrong. Please try again.');
            setLoading(false);
        } else {
            router.push('/dashboard');
        }
    }

    return (
        <div
            className="hero-bg"
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
        >
            {/* Back link */}
            <Link
                href="/"
                style={{
                    position: 'fixed',
                    top: 24,
                    left: 32,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}
            >
                ← Back
            </Link>

            <div style={{ width: '100%', maxWidth: 420 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, #7c5cfc, #3b82f6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 28,
                            fontWeight: 700,
                            margin: '0 auto 16px',
                        }}
                    >
                        H
                    </div>
                    <h1
                        style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            fontSize: '1.6rem',
                            fontWeight: 700,
                            marginBottom: 6,
                        }}
                    >
                        {mode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {mode === 'login'
                            ? 'Sign in to your AI orchestration hub'
                            : 'Join HeliosPrimer and connect your AIs'}
                    </p>
                </div>

                {/* Card */}
                <div className="glass-card" style={{ padding: 36 }}>
                    {/* Toggle */}
                    <div
                        style={{
                            display: 'flex',
                            background: 'var(--bg-secondary)',
                            borderRadius: 10,
                            padding: 4,
                            marginBottom: 28,
                        }}
                    >
                        {(['login', 'register'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    borderRadius: 8,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.88rem',
                                    transition: 'all 0.2s ease',
                                    background: mode === m ? 'linear-gradient(135deg, #7c5cfc, #3b82f6)' : 'transparent',
                                    color: mode === m ? 'white' : 'var(--text-muted)',
                                    fontFamily: 'Inter, sans-serif',
                                }}
                            >
                                {m === 'login' ? 'Sign In' : 'Register'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {mode === 'register' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    Full Name
                                </label>
                                <input
                                    className="input-field"
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                Email Address
                            </label>
                            <input
                                className="input-field"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div
                                style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    color: '#ef4444',
                                    fontSize: '0.85rem',
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ marginTop: 4, padding: '13px', fontSize: '0.95rem', borderRadius: 10 }}
                        >
                            <span>{loading ? 'Signing in...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}</span>
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Your API keys are encrypted with AES-256 and never shared.
                    </p>
                </div>
            </div>
        </div>
    );
}
