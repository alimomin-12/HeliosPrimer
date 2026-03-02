import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { getAdapter, type AIProvider } from '@/lib/ai/registry';
import type { ChatMessage } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { conversationId, provider, message, history } = await req.json();

    const connection = await prisma.aIConnection.findUnique({
        where: { userId_provider: { userId: session.user.id, provider } },
    });

    if (!connection || !connection.isActive) {
        return new Response('AI connection not found', { status: 404 });
    }

    const apiKey = decryptApiKey(connection.encryptedApiKey);
    const adapter = getAdapter(provider as AIProvider);

    const messages: ChatMessage[] = [
        ...(history || []),
        { role: 'user', content: message },
    ];

    // Save user message
    if (conversationId) {
        await prisma.message.create({
            data: { conversationId, role: 'user', content: message },
        });
    }

    // Stream response with SSE
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of adapter.streamChat(messages, apiKey, connection.model)) {
                    fullResponse += chunk;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
                }

                // Save assistant response
                if (conversationId) {
                    await prisma.message.create({
                        data: {
                            conversationId,
                            role: 'master',
                            content: fullResponse,
                            provider,
                        },
                    });
                    // Update conversation title from first message
                    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
                    if (conv?.title === 'New Conversation' && message.length > 0) {
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { title: message.slice(0, 60) },
                        });
                    }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (error) {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
