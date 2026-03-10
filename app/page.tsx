'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const FEATURES = [
  {
    icon: '🔗',
    title: 'Connect All Your AIs',
    desc: 'Link OpenAI GPT-4o, Google Gemini, Claude, and more using your existing API keys.',
  },
  {
    icon: '🧠',
    title: 'Master / Slave Orchestration',
    desc: 'Appoint one AI as Master to lead complex reasoning and delegate sub-tasks to specialized Slave AIs.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Collaboration',
    desc: 'Watch your AIs converse in real-time. See each delegation and response as it streams.',
  },
  {
    icon: '🔐',
    title: 'Your Keys, Your Control',
    desc: 'API keys are encrypted with AES-256 and stored securely. We never see your keys.',
  },
];

const PROVIDERS = [
  { name: 'OpenAI GPT-4o', color: '#10a37f', icon: '◎' },
  { name: 'Google Gemini', color: '#4285f4', icon: '✦' },
  { name: 'Anthropic Claude', color: '#d97706', icon: '◈' },
  { name: 'Mistral AI', color: '#7c3aed', icon: '◇' },
];

export default function LandingPage() {
  const [currentWord, setCurrentWord] = useState(0);
  const words = ['Collaborate', 'Orchestrate', 'Synthesize', 'Innovate'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hero-bg min-h-screen">
      {/* Navbar */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(10,10,15,0.8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7c5cfc, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            H
          </div>
          <span
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 700,
              fontSize: '1.2rem',
              letterSpacing: '-0.02em',
            }}
          >
            HeliosPrimer
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login">
            <button className="btn-secondary" style={{ padding: '8px 20px' }}>
              Sign In
            </button>
          </Link>
          <Link href="/login">
            <button className="btn-primary" style={{ padding: '8px 20px' }}>
              <span>Get Started Free →</span>
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 80px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)',
            border: '1px solid rgba(124,92,252,0.3)',
            borderRadius: 20,
            padding: '6px 16px',
            fontSize: '0.8rem',
            color: 'var(--accent-purple)',
            marginBottom: 32,
            fontWeight: 500,
          }}
        >
          <span className="pulse-dot" style={{ background: 'var(--accent-purple)' }} />
          Multi-Agent AI Orchestration Platform
        </div>

        <h1
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 16,
            maxWidth: 800,
            margin: '0 auto 16px',
          }}
        >
          Make Your AIs
          <br />
          <span className="gradient-text">{words[currentWord]}</span>
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            maxWidth: 560,
            margin: '20px auto 48px',
            lineHeight: 1.7,
          }}
        >
          Connect all your AI subscriptions under one login. Configure Master–Slave orchestration to
          get GPT-4o and Gemini working together for better answers.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login">
            <button
              className="btn-primary"
              style={{ padding: '14px 32px', fontSize: '1rem', borderRadius: 12 }}
            >
              <span>Start Orchestrating →</span>
            </button>
          </Link>
          <a
            href="#features"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '14px 24px',
              fontSize: '0.95rem',
            }}
          >
            See how it works ↓
          </a>
        </div>

        {/* Provider badges */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 56,
            flexWrap: 'wrap',
          }}
        >
          {PROVIDERS.map((p) => (
            <div
              key={p.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: `${p.color}15`,
                border: `1px solid ${p.color}40`,
                borderRadius: 20,
                padding: '8px 16px',
                fontSize: '0.85rem',
                color: p.color,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: '1rem' }}>{p.icon}</span>
              {p.name}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '2rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 56,
            letterSpacing: '-0.02em',
          }}
        >
          Everything you need to{' '}
          <span className="gradient-text">supercharge your AI workflow</span>
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card glass-card-hover" style={{ padding: 28, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div
                style={{
                  fontSize: '2rem',
                  marginBottom: 16,
                  background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)',
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  marginBottom: 10,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {f.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Orchestration diagram */}
      <section style={{ padding: '60px 48px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '48px 32px', background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.4rem',
              fontWeight: 700,
              marginBottom: 40,
            }}
          >
            How Orchestration Works
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
              flexWrap: 'wrap',
            }}
          >
            {/* User node */}
            <div
              style={{
                background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)',
                border: '1px solid rgba(124,92,252,0.3)',
                borderRadius: 14,
                padding: '16px 24px',
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>👤</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>User Query</div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '1.5rem', padding: '0 12px' }}>→</div>

            {/* Master */}
            <div
              style={{
                background: 'rgba(66,133,244,0.1)',
                border: '2px solid rgba(66,133,244,0.4)',
                borderRadius: 14,
                padding: '16px 24px',
                minWidth: 140,
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}>
                <span style={{ background: '#4285f4', color: 'white', fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>MASTER</span>
              </div>
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✦</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Google Gemini</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>Orchestrates & Synthesizes</div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '1.5rem', padding: '0 12px' }}>⇄</div>

            {/* Slaves */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  background: 'rgba(16,163,127,0.1)',
                  border: '1px solid rgba(16,163,127,0.3)',
                  borderRadius: 12,
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: 10,
                    background: '#10a37f',
                    color: 'white',
                    fontSize: '0.6rem',
                    padding: '2px 6px',
                    borderRadius: 8,
                    fontWeight: 700,
                  }}
                >
                  SLAVE
                </span>
                <span>◎</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>ChatGPT</span>
              </div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '1.5rem', padding: '0 12px' }}>→</div>

            {/* Final */}
            <div
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 14,
                padding: '16px 24px',
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✨</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Best Answer</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 48px', textAlign: 'center' }}>
        <div className="animated-border" style={{ display: 'inline-block', padding: 40, maxWidth: 600, width: '100%' }}>
          <h2
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.8rem',
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Ready to orchestrate your AIs?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
            Sign up with your email and connect your first AI in under 2 minutes.
          </p>
          <Link href="/login">
            <button
              className="btn-primary"
              style={{ padding: '14px 40px', fontSize: '1rem', borderRadius: 12 }}
            >
              <span>Get Started Free →</span>
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px 48px',
          display: 'flex',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        © 2026 HeliosPrimer · AI Orchestration Hub
      </footer>
    </div>
  );
}
