import OpenAI from 'openai';
import type { AIAdapter, ChatMessage } from '../types';

export const openAIAdapter: AIAdapter = {
    async chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
        const client = new OpenAI({ apiKey });
        const response = await client.chat.completions.create({
            model,
            messages: messages as any,
        });
        return response.choices[0]?.message?.content || '';
    },

    async *streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string> {
        const client = new OpenAI({ apiKey });
        const stream = await client.chat.completions.create({
            model,
            messages: messages as any,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
        }
    },

    async testConnection(apiKey: string, model: string): Promise<boolean> {
        try {
            const client = new OpenAI({ apiKey });
            await client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
            });
            return true;
        } catch {
            return false;
        }
    },
};
