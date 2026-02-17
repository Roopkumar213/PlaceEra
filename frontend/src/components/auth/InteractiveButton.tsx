import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost';
}

export const InteractiveButton: React.FC<ButtonProps> = ({
    children,
    isLoading,
    variant = 'primary',
    className,
    ...props
}) => {
    const baseStyles = "relative w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";

    const variants = {
        primary: "bg-plasma hover:bg-plasmaHover text-white shadow-[0_0_20px_-5px_rgba(110,68,255,0.5)] hover:shadow-[0_0_25px_-5px_rgba(110,68,255,0.7)] border border-white/10",
        secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-sm",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={cn(baseStyles, variants[variant], className)}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white/80" />
            ) : (
                children
            )}
            {/* Gloss Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/10 pointer-events-none" />
        </motion.button>
    );
};
