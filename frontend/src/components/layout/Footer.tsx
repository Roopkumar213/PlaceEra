import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 md:px-6">
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                    © 2026 Elevare.AI. All rights reserved. System Status: <span className="text-green-500 font-medium">Stable</span>
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>v2.1.0</span>
                </div>
            </div>
        </footer>
    );
};
