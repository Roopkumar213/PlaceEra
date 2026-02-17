import React from 'react';
import { cn } from '../../lib/utils';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className, ...props }) => {
    return (
        <div className={cn("container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-6 md:py-10", className)} {...props}>
            {children}
        </div>
    );
};
