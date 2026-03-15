import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return new Response('Not allowed', { status: 403 });
    }

    try {
        const filePath = path.join(process.cwd(), 'prisma', 'devKeys.json');
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'devKeys.json not found' }, { status: 404 });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        
        // The file format seems to be:
        // Gemini Api Key: [VALUE]
        // OpenAI Api Key: [VALUE]
        // ...
        
        const keys: Record<string, string> = {};
        const geminiMatch = content.match(/Gemini Api Key: \[([\s\S]*?)\]/);
        const openaiMatch = content.match(/OpenAI Api Key: \[([\s\S]*?)\]/);
        const qwenMatch = content.match(/Qwen Api Key: \[([\s\S]*?)\]/);
        const deepseekMatch = content.match(/DeepSeek Api Key: \[([\s\S]*?)\]/);

        if (geminiMatch) keys.GEMINI = geminiMatch[1].trim();
        if (openaiMatch) keys.OPENAI = openaiMatch[1].trim();
        if (qwenMatch) keys.QWEN = qwenMatch[1].trim();
        if (deepseekMatch) keys.DEEPSEEK = deepseekMatch[1].trim();

        return NextResponse.json(keys);
    } catch (error) {
        console.error('Error reading devKeys.json:', error);
        return NextResponse.json({ error: 'Failed to read devKeys.json' }, { status: 500 });
    }
}
