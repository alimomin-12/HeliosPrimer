import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import { getAdapter, type AIProvider } from '@/lib/ai/registry';

// GET /api/connections - list user's connections
// GET /api/connections?id=xxx - get a single connection including decrypted key (for editing)
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
        // Return a single connection with the decrypted API key for editing
        const conn = await prisma.aIConnection.findFirst({
            where: { id, userId: session.user.id },
        });
        if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({
            id: conn.id,
            provider: conn.provider,
            model: conn.model,
            isActive: conn.isActive,
            label: conn.label,
            apiKey: decryptApiKey(conn.encryptedApiKey),
        });
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

    const { id, provider, apiKey, model, label } = await req.json();

    if (!provider || !apiKey || !model) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const encrypted = encryptApiKey(apiKey);

    try {
        let connection;
        if (id) {
            // Update existing connection
            connection = await prisma.aIConnection.update({
                where: { id, userId: session.user.id },
                data: {
                    encryptedApiKey: encrypted,
                    model,
                    label,
                    isActive: true,
                },
                select: {
                    id: true,
                    provider: true,
                    model: true,
                    isActive: true,
                    label: true,
                },
            });
        } else {
            // Create new connection
            connection = await prisma.aIConnection.create({
                data: {
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
        }

        return NextResponse.json(connection);
    } catch (err: any) {
        console.error('[connections POST] Error:', err);
        return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
    }
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
