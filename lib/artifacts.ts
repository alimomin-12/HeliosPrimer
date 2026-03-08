export type ArtifactType = 'code' | 'markdown' | 'text';

export interface Artifact {
    id: string;
    messageId: string;
    title: string;
    language: string;      // e.g. 'python', 'javascript', 'markdown', 'plaintext'
    extension: string;     // file extension, e.g. 'py', 'js', 'md', 'txt'
    content: string;
    type: ArtifactType;
    createdAt: number;
}

// Language → file extension mapping
const LANG_EXTENSIONS: Record<string, string> = {
    python: 'py', py: 'py',
    javascript: 'js', js: 'js',
    typescript: 'ts', ts: 'ts',
    tsx: 'tsx', jsx: 'jsx',
    html: 'html', css: 'css',
    json: 'json', yaml: 'yaml', yml: 'yml',
    bash: 'sh', shell: 'sh', sh: 'sh',
    sql: 'sql',
    rust: 'rs', go: 'go', java: 'java',
    cpp: 'cpp', c: 'c', cs: 'cs',
    ruby: 'rb', php: 'php', swift: 'swift',
    kotlin: 'kt', dart: 'dart', r: 'r',
    xml: 'xml', toml: 'toml', ini: 'ini',
    markdown: 'md', md: 'md',
    dockerfile: 'dockerfile',
    plaintext: 'txt', text: 'txt', '': 'txt',
};

function getExtension(lang: string): string {
    return LANG_EXTENSIONS[lang.toLowerCase()] ?? (lang.toLowerCase() || 'txt');
}

function titleFromLanguage(lang: string, index: number): string {
    const labels: Record<string, string> = {
        python: 'Python Script', py: 'Python Script',
        javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript', ts: 'TypeScript',
        tsx: 'React Component', jsx: 'React Component',
        html: 'HTML Document', css: 'Stylesheet', json: 'JSON Data',
        yaml: 'YAML Config', yml: 'YAML Config',
        bash: 'Shell Script', shell: 'Shell Script', sh: 'Shell Script',
        sql: 'SQL Query', markdown: 'Markdown Document', md: 'Markdown Document',
        rust: 'Rust Code', go: 'Go Code', java: 'Java Code',
        cpp: 'C++ Code', c: 'C Code',
    };
    return labels[lang.toLowerCase()] ?? (lang ? `${lang.toUpperCase()} Code` : 'Text Output');
}

// Fenced code block regex: ```lang\ncontent\n```
const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;

/**
 * Extract artifacts (code blocks + significant markdown) from an AI response.
 */
export function extractArtifacts(messageId: string, content: string): Artifact[] {
    const artifacts: Artifact[] = [];
    const seen = new Set<string>(); // deduplicate by content hash
    let blockIndex = 0;

    // Reset regex state
    CODE_BLOCK_REGEX.lastIndex = 0;

    for (const match of content.matchAll(CODE_BLOCK_REGEX)) {
        const rawLang = (match[1] || '').trim().toLowerCase();
        const code = match[2].trim();

        if (!code || code.length < 10) continue; // skip trivially short blocks

        // Deduplicate
        const key = rawLang + ':' + code.slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);

        const lang = rawLang || 'plaintext';
        const ext = getExtension(lang);
        const type: ArtifactType = lang === 'markdown' || lang === 'md' ? 'markdown' : 'code';

        artifacts.push({
            id: `${messageId}-artifact-${blockIndex++}`,
            messageId,
            title: titleFromLanguage(lang, blockIndex),
            language: lang,
            extension: ext,
            content: code,
            type,
            createdAt: Date.now(),
        });
    }

    // If the entire response looks like a markdown document (has headers, lists, etc.)
    // and has no code blocks, treat the full response as a markdown artifact
    if (artifacts.length === 0) {
        const hasHeaders = /^#{1,3}\s+\w/m.test(content);
        const hasList = /^[-*]\s+\w/m.test(content);
        const isLongEnough = content.length > 300;

        if (hasHeaders && hasList && isLongEnough) {
            artifacts.push({
                id: `${messageId}-artifact-md`,
                messageId,
                title: 'Markdown Document',
                language: 'markdown',
                extension: 'md',
                content: content.trim(),
                type: 'markdown',
                createdAt: Date.now(),
            });
        }
    }

    return artifacts;
}

/**
 * Download content as a file in the browser.
 */
export function downloadAsFile(filename: string, content: string, mimeType = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Open a print-to-PDF window with the artifact content styled nicely.
 */
export function downloadAsPdf(artifact: Artifact): void {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const isCode = artifact.type === 'code';
    const escapedContent = artifact.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${artifact.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${isCode ? "'Courier New', Courier, monospace" : "Georgia, 'Times New Roman', serif"}; 
           font-size: 13px; color: #111; padding: 40px; line-height: 1.7; }
    h1 { font-size: 20px; margin-bottom: 6px; color: #1a1a2e; }
    .meta { font-size: 11px; color: #666; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; }
    pre { background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; padding: 20px; 
          white-space: pre-wrap; word-break: break-word; font-size: 12px; }
    p { margin: 0 0 12px; }
    @media print { body { padding: 20px; } button { display: none; } }
  </style>
</head>
<body>
  <h1>${artifact.title}</h1>
  <p class="meta">Language: ${artifact.language.toUpperCase()} &nbsp;|&nbsp; Generated by HeliosPrimer AI Hub &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</p>
  ${isCode ? `<pre>${escapedContent}</pre>` : `<div>${escapedContent.replace(/\n/g, '<br>')}</div>`}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
}
