import OpenAI from 'openai';
import type { AIAdapter, ChatMessage } from '../types';

// DeepSeek uses an OpenAI-compatible API at api.deepseek.com
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export const deepSeekAdapter: AIAdapter = {
    async chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
        const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
        const response = await client.chat.completions.create({
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: Array.isArray(m.content)
                    ? m.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n')
                    : m.content
            })) as any,
        });
        return response.choices[0]?.message?.content || '';
    },

    async *streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string> {
        const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
        const stream = await client.chat.completions.create({
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: Array.isArray(m.content)
                    ? m.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n')
                    : m.content
            })) as any,
            stream: true,
        });

        let hasStartedThinking = false;
        let hasFinishedThinking = false;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta as any; // Cast for reasoning_content support
            
            // DeepSeek Reasoner outputs CoT in `reasoning_content`
            if (delta?.reasoning_content) {
                if (!hasStartedThinking) {
                    hasStartedThinking = true;
                    yield '<think>\n';
                }
                yield delta.reasoning_content;
            } else if (delta?.content) {
                if (hasStartedThinking && !hasFinishedThinking) {
                    hasFinishedThinking = true;
                    yield '\n</think>\n\n';
                }
                yield delta.content;
            }
        }
        
        // Failsafe in case stream ended without content but had reasoning
        if (hasStartedThinking && !hasFinishedThinking) {
            yield '\n</think>\n\n';
        }
    },

    async testConnection(apiKey: string, model: string): Promise<boolean> {
        try {
            const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
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
