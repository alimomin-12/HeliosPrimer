'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

type Skill = {
    id: string;
    name: string;
    content: string;
    createdAt: string;
};

export default function SkillsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

    useEffect(() => {
        fetchSkills();
    }, []);

    const fetchSkills = async () => {
        try {
            const res = await fetch('/api/skills');
            if (res.ok) {
                const data = await res.json();
                setSkills(data);
            }
        } catch (error) {
            console.error('Failed to fetch skills:', error);
        }
    };

    const handleAddSkill = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, content }),
            });
            if (res.ok) {
                setName('');
                setContent('');
                fetchSkills();
            }
        } catch (error) {
            console.error('Failed to add skill:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;
        try {
            const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedSkill?.id === id) {
                    setSelectedSkill(null);
                }
                fetchSkills();
            }
        } catch (error) {
            console.error('Failed to delete skill:', error);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setContent(text);
                if (!name) {
                    setName(file.name.replace(/\.[^/.]+$/, ""));
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left Sidebar */}
            <div style={{ width: '320px', borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', fontWeight: 600 }}>Your Skills</h2>
                    <button 
                        onClick={() => setSelectedSkill(null)} 
                        style={{
                            width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)',
                            background: selectedSkill === null ? 'var(--bg-card)' : 'transparent',
                            color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600,
                            boxShadow: selectedSkill === null ? 'var(--theme-shadow)' : 'none',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        + Add New Skill
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {skills.map(skill => (
                            <button 
                                key={skill.id} 
                                onClick={() => setSelectedSkill(skill)}
                                style={{
                                    textAlign: 'left', padding: '12px 16px', borderRadius: '10px',
                                    border: selectedSkill?.id === skill.id ? '1px solid var(--accent-purple)' : '1px solid var(--border)',
                                    background: selectedSkill?.id === skill.id ? 'color-mix(in srgb, var(--accent-purple) 10%, transparent)' : 'var(--bg-card)',
                                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
                                }}
                            >
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{skill.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(skill.createdAt).toLocaleDateString()}</span>
                            </button>
                        ))}
                        {skills.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>No skills added yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Content Area */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={selectedSkill ? selectedSkill.id : 'new'}>
                    {selectedSkill ? (
                        <div style={{ maxWidth: 800 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h1 style={{ fontSize: '2rem' }}>{selectedSkill.name}</h1>
                                <button onClick={() => handleDelete(selectedSkill.id)} className="btn-secondary" style={{ padding: '8px 16px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                    Delete Skill
                                </button>
                            </div>
                            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content</h3>
                                <pre style={{ 
                                    whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', 
                                    background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px',
                                    border: '1px solid var(--border)', color: 'var(--text-secondary)'
                                }}>
                                    {selectedSkill.content}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: 800 }}>
                            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Create Skill</h1>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                                Upload markdown files or paste content to create reusable skills. You can trigger them in chat using the <code>/</code> command.
                            </p>

                            <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <form onSubmit={handleAddSkill} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Skill Name</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Code Reviewer"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Upload Markdown File</label>
                                        <input
                                            type="file"
                                            accept=".md,.txt"
                                            onChange={handleFileUpload}
                                            style={{ display: 'block', width: '100%', padding: '12px', border: '1px dashed var(--border)', borderRadius: '8px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Or Paste Content</label>
                                        <textarea
                                            className="input-field"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="Skill context or system prompt instructions..."
                                            style={{ minHeight: '200px', resize: 'vertical' }}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>
                                        {loading ? 'Saving...' : 'Save Skill'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
