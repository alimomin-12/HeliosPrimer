import OpenAI from 'openai';
import type { AIAdapter, ChatMessage } from '../types';

// Qwen uses an OpenAI-compatible API via Alibaba DashScope.
// International endpoint — works with api keys from international.dashscope.aliyuncs.com
const QWEN_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

export const qwenAdapter: AIAdapter = {
    async chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
        const client = new OpenAI({ apiKey, baseURL: QWEN_BASE_URL });
        const response = await client.chat.completions.create({
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: Array.isArray(m.content)
                    ? (m.content.some((p: any) => p.type === 'image_url')
                        ? m.content
                        : m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'))
                    : m.content
            })) as any,
        });
        return response.choices[0]?.message?.content || '';
    },

    async *streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string> {
        const client = new OpenAI({ apiKey, baseURL: QWEN_BASE_URL });
        const stream = await client.chat.completions.create({
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: Array.isArray(m.content)
                    ? (m.content.some((p: any) => p.type === 'image_url')
                        ? m.content
                        : m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'))
                    : m.content
            })) as any,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
        }
    },

    async testConnection(apiKey: string, model: string): Promise<boolean> {
        try {
            const client = new OpenAI({ apiKey, baseURL: QWEN_BASE_URL });
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
