import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    providers: [
        Credentials({
            name: 'Email',
            credentials: {
                email: { label: 'Email', type: 'email' },
                name: { label: 'Name', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email) return null;

                const email = credentials.email as string;
                const name = credentials.name as string | undefined;

                // Upsert user on login (passwordless for demo; production would use magic links)
                const user = await prisma.user.upsert({
                    where: { email },
                    update: {},
                    create: {
                        email,
                        name: name || email.split('@')[0],
                        emailVerified: new Date(),
                    },
                });

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});
