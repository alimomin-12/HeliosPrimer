import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAdapter, ChatMessage, ChatContentPart } from '../types';

function toGeminiHistory(messages: ChatMessage[]) {
    const filtered = messages.filter((m) => m.role !== 'system');

    const merged: { role: 'user' | 'model'; parts: any[] }[] = [];
    for (const msg of filtered) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        
        const parts = Array.isArray(msg.content)
            ? msg.content.map((part) => {
                if (part.type === 'text') return { text: part.text };
                if (part.type === 'image_url') {
                    // Expecting data:image/png;base64,...
                    const [header, data] = part.image_url.url.split(';base64,');
                    const mimeType = header.split(':')[1];
                    return { inlineData: { mimeType, data } };
                }
                return { text: '' };
            })
            : [{ text: msg.content }];

        const last = merged[merged.length - 1];
        if (last && last.role === geminiRole) {
            last.parts.push(...parts);
        } else {
            merged.push({ role: geminiRole, parts });
        }
    }
    return merged;
}

function getSystemInstruction(messages: ChatMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    if (!systemMsg) return undefined;
    
    const text = Array.isArray(systemMsg.content)
        ? systemMsg.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n')
        : systemMsg.content;
        
    return { role: 'user' as const, parts: [{ text }] };
}

function mapContentToGemini(content: string | ChatContentPart[]) {
    if (typeof content === 'string') return content;
    return content.map((part) => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image_url') {
            const [header, data] = part.image_url.url.split(';base64,');
            const mimeType = header.split(':')[1];
            return { inlineData: { mimeType, data } };
        }
        return { text: '' };
    });
}

export const geminiAdapter: AIAdapter = {
    async chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({
            model,
            systemInstruction: getSystemInstruction(messages),
        });

        // All messages except the last one go to history
        const historyMsgs = messages.filter((m) => m.role !== 'system').slice(0, -1);
        const history = toGeminiHistory(historyMsgs);
        const lastMsg = messages.filter((m) => m.role !== 'system').at(-1);

        if (!lastMsg) throw new Error('No user message found in chat');

        const chat = geminiModel.startChat({ history });
        const result = await chat.sendMessage(mapContentToGemini(lastMsg.content) as any);
        return result.response.text();
    },

    async *streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({
            model,
            systemInstruction: getSystemInstruction(messages),
        });

        const historyMsgs = messages.filter((m) => m.role !== 'system').slice(0, -1);
        const history = toGeminiHistory(historyMsgs);
        const lastMsg = messages.filter((m) => m.role !== 'system').at(-1);

        if (!lastMsg) throw new Error('No user message found in streamChat');

        const chat = geminiModel.startChat({ history });
        const result = await chat.sendMessageStream(mapContentToGemini(lastMsg.content) as any);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    },

    async testConnection(apiKey: string, model: string): Promise<boolean> {
        // Do NOT catch here — let the caller handle the error for proper reporting
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });
        await geminiModel.generateContent('Hi');
        return true;
    },
};
