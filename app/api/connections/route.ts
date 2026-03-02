import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import { getAdapter, type AIProvider } from '@/lib/ai/registry';

// GET /api/connections - list user's connections
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connections = await prisma.aIConnection.findMany({
        where: { userId: session.user.id },
        select: {
            id: true,
            provider: true,
            model: true,
            isActive: true,
            label: true,
            createdAt: true,
            // Never return the encrypted key to client
        },
    });

    return NextResponse.json(connections);
}

// POST /api/connections - add a new connection
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey, model, label } = await req.json();

    if (!provider || !apiKey || !model) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const encrypted = encryptApiKey(apiKey);

    const connection = await prisma.aIConnection.upsert({
        where: {
            userId_provider: {
                userId: session.user.id,
                provider,
            },
        },
        update: {
            encryptedApiKey: encrypted,
            model,
            label,
            isActive: true,
        },
        create: {
            userId: session.user.id,
            provider,
            encryptedApiKey: encrypted,
            model,
            label,
        },
        select: {
            id: true,
            provider: true,
            model: true,
            isActive: true,
            label: true,
        },
    });

    return NextResponse.json(connection);
}

// DELETE /api/connections?id=xxx
export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.aIConnection.deleteMany({
        where: { id, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
}
