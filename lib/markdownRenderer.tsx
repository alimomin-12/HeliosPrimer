import React from 'react';

/** Lightweight inline markdown renderer — no external dependencies. */
export function renderMarkdownText(text: string): React.ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let key = 0;

    function renderInline(s: string): React.ReactNode {
        const parts: React.ReactNode[] = [];
        const RE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
        let last = 0;
        let m: RegExpExecArray | null;
        RE.lastIndex = 0;
        while ((m = RE.exec(s)) !== null) {
            if (m.index > last) parts.push(s.slice(last, m.index));
            if (m[2]) {
                parts.push(<strong key={key++}>{m[2]}</strong>);
            } else if (m[3]) {
                parts.push(<em key={key++}>{m[3]}</em>);
            } else if (m[4]) {
                parts.push(
                    <code key={key++} style={{
                        background: 'rgba(124,92,252,0.12)',
                        color: 'var(--accent-purple)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontFamily: "'Courier New',monospace",
                        fontSize: '0.88em',
                    }}>{m[4]}</code>
                );
            }
            last = m.index + m[0].length;
        }
        if (last < s.length) parts.push(s.slice(last));
        return parts.length === 1 ? parts[0] : <>{parts}</>;
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
            i++; continue;
        }

        // Headings
        const hMatch = line.match(/^(#{1,4})\s+(.*)/);
        if (hMatch) {
            const level = hMatch[1].length;
            const sizes = ['1.18rem', '1.04rem', '0.94rem', '0.87rem'];
            const margins = ['16px 0 8px', '12px 0 6px', '10px 0 4px', '8px 0 4px'];
            nodes.push(
                <div key={key++} style={{
                    fontWeight: 700,
                    fontSize: sizes[level - 1] || '0.94rem',
                    margin: margins[level - 1] || '8px 0 4px',
                    fontFamily: 'Space Grotesk, Inter, sans-serif',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                }}>
                    {renderInline(hMatch[2])}
                </div>
            );
            i++; continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            nodes.push(
                <div key={key++} style={{
                    borderLeft: '3px solid var(--accent-purple)',
                    paddingLeft: 12,
                    margin: '6px 0',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    fontSize: '0.9rem',
                }}>
                    {renderInline(line.slice(2))}
                </div>
            );
            i++; continue;
        }

        // Unordered list — collect consecutive items
        if (/^[-*+]\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
                items.push(lines[i].replace(/^[-*+]\s/, ''));
                i++;
            }
            nodes.push(
                <ul key={key++} style={{ margin: '6px 0 6px 20px', padding: 0, color: 'var(--text-primary)', lineHeight: 1.75, fontSize: '0.9rem' }}>
                    {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
                </ul>
            );
            continue;
        }

        // Ordered list
        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\.\s/, ''));
                i++;
            }
            nodes.push(
                <ol key={key++} style={{ margin: '6px 0 6px 20px', padding: 0, color: 'var(--text-primary)', lineHeight: 1.75, fontSize: '0.9rem' }}>
                    {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
                </ol>
            );
            continue;
        }

        // Blank line → small spacer
        if (line.trim() === '') {
            nodes.push(<div key={key++} style={{ height: 8 }} />);
            i++; continue;
        }

        // Normal paragraph line
        nodes.push(
            <span key={key++} style={{ display: 'block', lineHeight: 1.75, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {renderInline(line)}
            </span>
        );
        i++;
    }

    return <>{nodes}</>;
}
