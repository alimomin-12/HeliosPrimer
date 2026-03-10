import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all messages to calculate tokens, but we don't need to send all content to the client
    const conversations = await prisma.conversation.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            messages: {
                select: {
                    content: true,
                    role: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            },
            orchestrationConfig: { select: { masterProvider: true, slaveProviders: true } },
        },
    });

    // Helper to estimate tokens (same as frontend)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    const mapped = conversations.map(conv => {
        let totalTokens = 0;
        
        // Calculate token count from all messages
        conv.messages.forEach(msg => {
            try {
                // Check if content is JSON (multi-modal)
                if (msg.content.trim().startsWith('[')) {
                    const parsed = JSON.parse(msg.content);
                    if (Array.isArray(parsed)) {
                        parsed.forEach((part: any) => {
                            if (part.type === 'text' && part.text) {
                                totalTokens += estimateTokens(part.text);
                            } else if (part.type === 'image_url') {
                                totalTokens += 500; // Flat estimate for images
                            }
                        });
                    }
                } else {
                    totalTokens += estimateTokens(msg.content);
                }
            } catch (e) {
                totalTokens += estimateTokens(msg.content);
            }
        });

        // Send back the full metadata plus the first message for preview
        const previewMessage = conv.messages.length > 0 ? [conv.messages[0]] : [];
        
        return {
            ...conv,
            messages: previewMessage,
            totalTokens,
            messageCount: conv.messages.length
        };
    });

    return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, mode } = await req.json();

    const conversation = await prisma.conversation.create({
        data: {
            userId: session.user.id,
            title: title || 'New Conversation',
            mode: mode || 'DIRECT',
        },
    });

    return NextResponse.json(conversation);
}
