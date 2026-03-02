import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { getAdapter, type AIProvider } from '@/lib/ai/registry';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, model: overrideModel } = await req.json();

    const connection = await prisma.aIConnection.findUnique({
        where: {
            userId_provider: {
                userId: session.user.id,
                provider,
            },
        },
    });

    if (!connection) {
        return NextResponse.json({ valid: false, error: 'Connection not found' });
    }

    const apiKey = decryptApiKey(connection.encryptedApiKey);
    const testModel = overrideModel || connection.model;
    const adapter = getAdapter(provider as AIProvider);

    try {
        const valid = await adapter.testConnection(apiKey, testModel);
        return NextResponse.json({ valid, model: testModel });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Connection Test] ${provider} error:`, message);
        return NextResponse.json({ valid: false, error: message, model: testModel });
    }
}
