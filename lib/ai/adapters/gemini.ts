import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAdapter, ChatMessage } from '../types';

function toGeminiHistory(messages: ChatMessage[]) {
    return messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
}

export const geminiAdapter: AIAdapter = {
    async chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });

        const systemMsg = messages.find((m) => m.role === 'system');
        const history = toGeminiHistory(messages.slice(0, -1));
        const lastMsg = messages[messages.length - 1];

        const chat = geminiModel.startChat({
            history,
            systemInstruction: systemMsg?.content,
        });

        const result = await chat.sendMessage(lastMsg.content);
        return result.response.text();
    },

    async *streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });

        const systemMsg = messages.find((m) => m.role === 'system');
        const history = toGeminiHistory(messages.slice(0, -1));
        const lastMsg = messages[messages.length - 1];

        const chat = geminiModel.startChat({
            history,
            systemInstruction: systemMsg?.content,
        });

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
