import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    icon?: LucideIcon;
}

export const AntigravityInput = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className, icon: Icon, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-medium text-gray-400 ml-1 uppercase tracking-wider">
                    {label}
                </label>
                <div className="relative">
                    <motion.div
                        whileTap={{ scale: 0.995 }}
                        className={cn(
                            "group relative flex items-center w-full rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 focus-within:border-plasma focus-within:ring-1 focus-within:ring-plasma/50 hover:bg-white/10",
                            error && "border-error focus-within:border-error focus-within:ring-error/50"
                        )}
                    >
                        {Icon && (
                            <div className="pl-4 text-gray-400 group-focus-within:text-plasma transition-colors">
                                <Icon size={18} />
                            </div>
                        )}
                        <input
                            ref={ref}
                            className={cn(
                                "w-full bg-transparent border-none py-3.5 text-white placeholder-gray-600 focus:ring-0 focus:outline-none text-sm font-sans",
                                Icon ? "pl-3 pr-4" : "px-4",
                                className
                            )}
                            {...props}
                        />
                    </motion.div>
                </div>
                {error && (
                    <motion.span
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-error ml-1 font-medium"
                    >
                        {error}
                    </motion.span>
                )}
            </div>
        );
    }
);
