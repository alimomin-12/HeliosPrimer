export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIAdapter {
    chat(messages: ChatMessage[], apiKey: string, model: string): Promise<string>;
    streamChat(messages: ChatMessage[], apiKey: string, model: string): AsyncIterable<string>;
    testConnection(apiKey: string, model: string): Promise<boolean>;
}
