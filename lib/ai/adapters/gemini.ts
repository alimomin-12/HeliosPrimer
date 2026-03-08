import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAdapter, ChatMessage } from '../types';

function toGeminiHistory(messages: ChatMessage[]) {
    // Convert to Gemini format, skipping system messages (handled separately)
    // Gemini requires strict alternating user/model turns
    const filtered = messages.filter((m) => m.role !== 'system');

    // Merge consecutive same-role messages to avoid Gemini API errors
    const merged: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const msg of filtered) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        const last = merged[merged.length - 1];
        if (last && last.role === geminiRole) {
            // Merge into previous entry
            last.parts[0].text += '\n' + msg.content;
        } else {
            merged.push({ role: geminiRole, parts: [{ text: msg.content }] });
        }
    }
    return merged;
}

function getSystemInstruction(messages: ChatMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    if (!systemMsg) return undefined;
    // Gemini SDK requires a Content object (role + parts) for systemInstruction
    return { role: 'user' as const, parts: [{ text: systemMsg.content }] };
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
        const result = await chat.sendMessage(lastMsg.content);
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
        const result = await chat.sendMessageStream(lastMsg.content);
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
