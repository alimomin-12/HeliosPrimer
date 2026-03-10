'use client';

import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/layout/Sidebar';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <div style={{ display: 'flex', minHeight: '100vh' }}>
                    <Sidebar />
                    <main
                        style={{
                            flex: 1,
                            marginLeft: 260,
                            background: 'var(--bg-primary)',
                            minHeight: '100vh',
                            overflow: 'auto',
                        }}
                    >
                        {children}
                    </main>
                </div>
            </ThemeProvider>
        </SessionProvider>
    );
}
