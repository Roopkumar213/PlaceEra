import React, { useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Terminal, Zap, Mic, Trophy, Code2, Play, ChevronRight, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NeuralCore from '../components/NeuralCore';
import { InteractiveButton } from '../components/InteractiveButton';

const ScrollSection: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className, delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

// Mock Tech Companies Logos
const CompanyLogos = [
    { name: "Google", color: "#4285F4" },
    { name: "Microsoft", color: "#F25022" },
    { name: "Amazon", color: "#FF9900" },
    { name: "Meta", color: "#0668E1" },
    { name: "Netflix", color: "#E50914" },
];

const Landing: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { scrollYProgress } = useScroll();
    const yHero = useTransform(scrollYProgress, [0, 1], [0, 300]);

    // Redirect logic for logged-in users is handled in routes or here
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);



    return (
        <div className="relative w-full min-h-screen bg-void overflow-x-hidden selection:bg-primary/30 selection:text-white font-sans">

            {/* Fixed Navigation */}
            <nav className="fixed top-0 w-full z-50 px-6 py-4 border-b border-white/5 bg-void/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-mono font-bold text-white shadow-[0_0_15px_rgba(110,68,255,0.3)]">
                            E
                        </div>
                        <span className="font-display font-bold text-lg tracking-wide hidden sm:block text-white">ELEVARE</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400 font-mono">
                        <a href="#system" className="hover:text-primary transition-colors">How It Works</a>
                        <a href="#curriculum" className="hover:text-primary transition-colors">Curriculum</a>
                        <a href="#analytics" className="hover:text-primary transition-colors">Progress</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link to="/login" className="hidden sm:block text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Login
                        </Link>
                        <Link to="/register">
                            <InteractiveButton variant="primary" className="!py-2 !px-5 !text-xs !rounded-lg font-mono tracking-wide">
                                Start Training
                            </InteractiveButton>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="relative w-full h-screen flex items-center justify-center overflow-hidden pt-20">
                {/* 3D Background */}
                <motion.div
                    style={{ y: yHero }}
                    className="absolute inset-0 z-0 opacity-40 md:opacity-80"
                >
                    <NeuralCore />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-b from-void via-transparent to-void z-0 pointer-events-none" />

                {/* Hero Content */}
                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary uppercase tracking-widest"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        AI-Powered Training Engine
                    </motion.div>

                    <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight mb-8 text-white">
                        Build Placement-Ready<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-cyan-400">Skills. Every Day.</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl mb-12 leading-relaxed">
                        Structured AI-powered training for DSA, Backend, Aptitude, and Interviews — with measurable progress.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <Link to="/register" className="w-full sm:w-auto">
                            <InteractiveButton className="w-full sm:w-auto !px-8 !py-4 !text-base shadow-[0_0_40px_-10px_rgba(110,68,255,0.4)] font-bold">
                                Start Daily Training <ArrowRight className="w-4 h-4" />
                            </InteractiveButton>
                        </Link>
                        <a href="#system" className="w-full sm:w-auto group flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all backdrop-blur-sm">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Play className="w-3 h-3 fill-white ml-0.5" />
                            </div>
                            <span>See How It Works</span>
                        </a>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-600 flex flex-col items-center gap-2"
                >
                    <span className="text-[10px] uppercase tracking-widest font-mono">Scroll to Scan</span>
                    <div className="w-px h-12 bg-gradient-to-b from-gray-600 to-transparent" />
                </motion.div>
            </section>

            {/* SOCIAL PROOF */}
            <section className="py-12 border-y border-white/5 bg-surface/30 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-xs font-mono text-gray-500 mb-8 uppercase tracking-widest">Alumni Deployed At</p>
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                        {CompanyLogos.map((logo, idx) => (
                            <div key={idx} className="flex items-center gap-2 group cursor-default hover:scale-105 transition-transform">
                                <div className="w-6 h-6 rounded bg-current opacity-20 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: logo.color }}></div>
                                <span className="font-bold text-lg text-gray-400 group-hover:text-white transition-colors">{logo.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* THE PROBLEM */}
            <section className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-20">
                        <h2 className="font-display text-4xl font-bold mb-4">Why Random Prep <span className="text-red-500">Fails</span></h2>
                        <p className="text-gray-400 max-w-xl mx-auto">Consumption does not equal retention. You need a system.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: "Structured Daily Curriculum", desc: "Follow a rotating system covering DSA, Backend, Aptitude, and Core CS — no random prep.", color: "text-purple-400" },
                            { title: "Adaptive Weakness Engine", desc: "We detect low scores and automatically reschedule revision sessions for your weak zones.", color: "text-orange-400" },
                            { title: "Interview Simulation Mode", desc: "Practice timed coding and technical follow-ups like real interviews.", color: "text-blue-400" }
                        ].map((item, i) => (
                            <ScrollSection key={i} delay={i * 0.2} className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <h3 className={`text-xl font-bold mb-4 ${item.color}`}>{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
                            </ScrollSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* CORE FEATURES SYSTEM */}
            <section id="system" className="py-32 bg-surface relative overflow-hidden">
                {/* Radial Gradient Background */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <ScrollSection className="text-center mb-20">
                        <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">The <span className="text-gradient-primary">Elevare Engine</span></h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">Leave generic tutorials behind. Train with a system designed to simulate the intensity of real technical assessments.</p>
                    </ScrollSection>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 1. Structured Daily Curriculum */}
                        <ScrollSection className="glass-card p-8 group hover:bg-white/5 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary mb-6">
                                <Code2 size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Daily Structured Curriculum</h3>
                            <p className="text-gray-400">Follow a rotating system covering DSA, Backend Development, Aptitude, and Core CS. No random preparation.</p>
                        </ScrollSection>

                        {/* 2. Graded Practice System */}
                        <ScrollSection delay={0.1} className="glass-card p-8 group hover:bg-white/5 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 mb-6">
                                <Zap size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Learn. Solve. Get Scored.</h3>
                            <p className="text-gray-400">Each topic includes guided explanation and a graded quiz to measure understanding.</p>
                        </ScrollSection>

                        {/* 3. Adaptive Revision Engine */}
                        <ScrollSection delay={0.2} className="glass-card p-8 group hover:bg-white/5 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 mb-6">
                                <RefreshCw size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Automatic Weak Topic Revision</h3>
                            <p className="text-gray-400">Score below threshold? We automatically reschedule the topic to strengthen retention.</p>
                        </ScrollSection>

                        {/* 4. Placement Analytics */}
                        <ScrollSection delay={0.3} className="glass-card p-8 group hover:bg-white/5 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-6">
                                <Trophy size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Track Your Placement Readiness</h3>
                            <p className="text-gray-400">Monitor subject-wise performance, consistency streak, and weekly improvement.</p>
                        </ScrollSection>

                    </div>
                </div>
            </section>

            {/* GROWTH DASHBOARD VISUAL */}
            <section id="curriculum" className="py-32 bg-void relative overflow-hidden border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <ScrollSection>
                        <h2 className="font-display text-4xl font-bold mb-6 text-white">Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Growth Dashboard</span></h2>
                        <ul className="space-y-6">
                            {[
                                { title: "DSA Performance", score: "72%", color: "bg-blue-500", width: "w-[72%]" },
                                { title: "Backend Development", score: "65%", color: "bg-purple-500", width: "w-[65%]" },
                                { title: "Aptitude & Logic", score: "88%", color: "bg-green-500", width: "w-[88%]" }
                            ].map((item, idx) => (
                                <li key={idx} className="group relative z-10 glass-panel p-4 border border-white/5">
                                    <div className="flex justify-between items-end mb-2">
                                        <h4 className="font-bold text-gray-200">{item.title}</h4>
                                        <span className="font-mono text-primary">{item.score}</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color} rounded-full`} style={{ width: item.score }}></div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ScrollSection>

                    <ScrollSection className="relative h-[400px] glass-panel border border-white/5 flex items-center justify-center bg-surface/30">
                        <div className="text-center">
                            <div className="inline-block relative scale-125">
                                <div className="w-40 h-40 rounded-full border-4 border-white/5 flex items-center justify-center relative z-10 bg-void shadow-2xl">
                                    <div className="flex flex-col">
                                        <span className="text-5xl font-mono font-bold text-white">85%</span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Ready</span>
                                    </div>
                                </div>
                                {/* Rotating Rings - Reduced Glow */}
                                <div className="absolute inset-0 border-2 border-primary/50 rounded-full border-t-transparent animate-[spin_3s_linear_infinite]" />
                                <div className="absolute -inset-4 border border-cyan-500/20 rounded-full animate-pulse-slow" />
                            </div>
                            <p className="mt-12 font-mono text-primary">PLACEMENT READINESS SCORE</p>
                            <p className="text-[10px] text-gray-500 mt-2 max-w-[200px] mx-auto">Calculated from quiz performance, consistency, and mock interviews.</p>
                        </div>
                    </ScrollSection>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="py-32 relative text-center overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px]" />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-6">
                    <h2 className="font-display text-5xl md:text-7xl font-bold mb-8 text-white">Start Your <span className="text-primary">Daily Placement System.</span></h2>
                    <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">Join the network of developers building their future. Consistency builds careers.</p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/register">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="group relative px-8 py-4 bg-white text-black font-bold text-lg rounded-full overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] transition-shadow"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Start Training Today <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </motion.button>
                        </Link>
                        <a href="#curriculum" className="px-8 py-4 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-colors">
                            Explore Curriculum
                        </a>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-void border-t border-white/5 py-12 px-6 font-mono text-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Terminal className="w-4 h-4" />
                        <span>Built for disciplined growth.</span>
                    </div>
                    <div className="flex gap-8 text-gray-500">
                        <a href="#" className="hover:text-primary transition-colors">Manifesto</a>
                        <a href="#" className="hover:text-primary transition-colors">Docs</a>
                        <a href="#" className="hover:text-primary transition-colors">Twitter</a>
                    </div>
                    <div className="text-gray-700">
                        © 2025 ALL RIGHTS RESERVED
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
