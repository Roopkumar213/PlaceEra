import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import NeuralCore from './NeuralCore';
import ErrorBoundary from './ErrorBoundary';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className="flex min-h-screen bg-void text-white overflow-hidden font-sans">

            {/* Left Panel: The Void (Desktop Only) */}
            <div className="hidden lg:flex w-[60%] relative flex-col justify-between p-12 bg-nebula overflow-hidden">

                {/* Animated Background Mesh */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-plasma/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-data/10 rounded-full blur-[100px]" />
                </div>

                {/* 3D Element */}
                <div className="absolute inset-0 z-10 w-full h-full overflow-hidden">
                    <ErrorBoundary>
                        <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-white/50">Loading 3D...</div>}>
                            <NeuralCore />
                        </Suspense>
                    </ErrorBoundary>
                </div>

                {/* Content Layer */}
                <div className="relative z-20">
                    <h1 className="text-2xl font-bold tracking-tight font-display">ELEVARE.AI</h1>
                </div>

                <div className="relative z-20 max-w-lg">
                    <blockquote className="text-2xl font-medium leading-relaxed font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
                        "The only way to predict the future is to create it. Master your placement preparation with AI-driven precision."
                    </blockquote>

                    <div className="mt-8 flex items-center gap-4">
                        <div className="flex -space-x-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full bg-white/10 border border-void backdrop-blur-md flex items-center justify-center text-xs font-bold">
                                    {/* Placeholder avatars */}
                                    <div className="w-full h-full bg-gradient-to-br from-white/20 to-transparent rounded-full" />
                                </div>
                            ))}
                        </div>
                        <div className="text-sm font-medium text-gray-400">
                            <span className="text-white">2,000+</span> students joined this week
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: The Cockpit */}
            <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-6 relative z-30">
                <div className="w-full max-w-[420px] mx-auto">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8 text-center lg:text-left"
                    >
                        <div className="lg:hidden mb-6 flex justify-center">
                            <div className="w-12 h-12 bg-plasma/20 rounded-xl flex items-center justify-center border border-plasma/30">
                                <div className="w-6 h-6 bg-plasma rounded-full blur-sm" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2 font-display">{title}</h2>
                        <p className="text-gray-400">{subtitle}</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="space-y-6"
                    >
                        {children}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 text-center"
                    >
                        <p className="text-xs text-gray-600">
                            Protected by Antigravity Auth System v2.0
                        </p>
                    </motion.div>

                </div>
            </div>
        </div>
    );
};
