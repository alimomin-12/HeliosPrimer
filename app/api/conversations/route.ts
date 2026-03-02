import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            messages: { take: 1, orderBy: { createdAt: 'desc' } },
            orchestrationConfig: { select: { masterProvider: true, slaveProviders: true } },
        },
    });

    return NextResponse.json(conversations);
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
