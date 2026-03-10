import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { runOrchestration, type OrchestrationStep } from '@/lib/ai/orchestrator';
import type { AIProvider } from '@/lib/ai/registry';
import type { ChatMessage } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { conversationId, masterProvider, slaveProviders, message, history, researchMode } = await req.json();

    // Fetch master connection
    const masterConn = await prisma.aIConnection.findUnique({
        where: { userId_provider: { userId: session.user.id, provider: masterProvider } },
    });

    if (!masterConn) {
        return new Response('Master AI connection not found', { status: 404 });
    }

    // Fetch slave connections
    const slaveConns = await Promise.all(
        (slaveProviders as string[]).map((p) =>
            prisma.aIConnection.findUnique({
                where: { userId_provider: { userId: session.user.id, provider: p } },
            })
        )
    );

    const validSlaves = slaveConns.filter(Boolean);

    if (validSlaves.length === 0) {
        return new Response('No slave AI connections found', { status: 404 });
    }

    // Save user message
    if (conversationId) {
        await prisma.message.create({
            data: { conversationId, role: 'user', content: typeof message === 'string' ? message : JSON.stringify(message) },
        });
        // Upsert orchestration config
        await prisma.orchestrationConfig.upsert({
            where: { conversationId },
            update: { masterProvider, slaveProviders: JSON.stringify(slaveProviders) },
            create: {
                userId: session.user.id,
                conversationId,
                masterProvider,
                slaveProviders: JSON.stringify(slaveProviders),
            },
        });
    }

    const encoder = new TextEncoder();
    let finalAnswer = '';
    const thinkingBuffer: string[] = [];

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const gen = runOrchestration({
                    masterProvider: masterProvider as AIProvider,
                    masterApiKey: decryptApiKey(masterConn.encryptedApiKey),
                    masterModel: masterConn.model,
                    slaves: validSlaves.map((c) => ({
                        provider: c!.provider as AIProvider,
                        apiKey: decryptApiKey(c!.encryptedApiKey),
                        model: c!.model,
                    })),
                    userQuery: message,
                    conversationHistory: (history || []) as ChatMessage[],
                    onStep: () => { },
                    researchMode: !!researchMode,
                });

                for await (const step of gen) {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(step)}\n\n`)
                    );

                    if (step.type === 'final') {
                        finalAnswer += step.content;
                    } else if (step.type === 'thinking') {
                        thinkingBuffer.push(step.content);
                    }
                }

                // Persist messages
                if (conversationId) {
                    // Save thinking steps
                    for (const thinking of thinkingBuffer) {
                        await prisma.message.create({
                            data: {
                                conversationId,
                                role: 'master',
                                content: thinking,
                                provider: masterProvider,
                                thinkingStep: true,
                            },
                        });
                    }
                    // Save final answer
                    if (finalAnswer) {
                        await prisma.message.create({
                            data: {
                                conversationId,
                                role: 'master',
                                content: finalAnswer,
                                provider: masterProvider,
                                thinkingStep: false,
                            },
                        });
                    }
                    // Update title
                    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
                    if (conv?.title === 'New Conversation') {
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { title: message.slice(0, 60) },
                        });
                    }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                const errStack = err instanceof Error ? err.stack : '';
                console.error('[Orchestration error]', errMsg);
                console.error('[Orchestration stack]', errStack);
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'error', content: `Orchestration failed: ${errMsg}` })}\n\n`)
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
