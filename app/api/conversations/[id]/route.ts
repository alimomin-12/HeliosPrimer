import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/conversations/[id] — load full conversation with all messages
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id, userId: session.user.id },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                orchestrationConfig: true,
            },
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(conversation);
    } catch (err) {
        console.error('[GET /api/conversations/[id]] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/conversations/[id]
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.conversation.deleteMany({
        where: { id, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
}
