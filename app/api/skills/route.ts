import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const skills = await prisma.skill.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(skills);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name, content } = await req.json();
        
        if (!name || !content) {
            return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
        }

        const skill = await prisma.skill.create({
            data: {
                userId: session.user.id,
                name,
                content,
            },
        });
        
        return NextResponse.json(skill);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
