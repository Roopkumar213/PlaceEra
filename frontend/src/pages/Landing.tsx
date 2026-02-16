import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Terminal, Zap, Mic, Trophy, Code2, Users, CheckCircle2, ChevronRight, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import NeuralCore from '../components/NeuralCore';
import errorBoundary from '../components/ErrorBoundary'; // Check case if needed, assuming default export
import { InteractiveButton } from '../components/InteractiveButton';

// Utility for smooth scroll
const ScrollSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
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

    // Typing Effect State for Hero
    const [typedText, setTypedText] = React.useState('');
    const fullText = "Master the system.";

    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            setTypedText(fullText.slice(0, index + 1));
            index++;
            if (index > fullText.length) clearInterval(interval);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full min-h-screen bg-void overflow-x-hidden selection:bg-primary/30 selection:text-white">

            {/* Fixed Navigation */}
            <nav className="fixed top-0 w-full z-50 px-6 py-4 glass-panel border-b-0 rounded-none bg-void/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center font-mono font-bold text-white">
                            A
                        </div>
                        <span className="font-display font-bold text-xl tracking-wide hidden sm:block">ANTIGRAVITY</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors">Training</a>
                        <a href="#mock-interviews" className="hover:text-white transition-colors">Interviews</a>
                        <a href="#leaderboard" className="hover:text-white transition-colors">Leaderboard</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pro</a>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <Link to="/dashboard">
                                <InteractiveButton variant="primary" className="!py-2 !px-4 !text-xs !rounded-lg">
                                    Console
                                </InteractiveButton>
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="hidden sm:block text-sm text-gray-300 hover:text-white transition-colors">
                                    Login
                                </Link>
                                <Link to="/register">
                                    <InteractiveButton variant="secondary" className="!py-2 !px-4 !text-xs !rounded-lg !bg-white/10 hover:!bg-white/20">
                                        Join Cadet Program
                                    </InteractiveButton>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="relative w-full h-screen flex items-center justify-center overflow-hidden pt-20">
                {/* Background 3D Core - Parallax */}
                <motion.div
                    style={{ y: yHero }}
                    className="absolute inset-0 z-0 opacity-60 md:opacity-100"
                >
                    <NeuralCore />
                </motion.div>

                {/* Hero Content */}
                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary uppercase tracking-wider"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        System Online v2.0
                    </motion.div>

                    <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight mb-6">
                        <span className="text-white">Crack the Code.</span><br />
                        <span className="text-gradient-primary">{typedText}</span><span className="animate-pulse text-primary">_</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
                        The daily AI-powered training ground for elite developers.
                        Practice algorithms, simulate interviews, and track your climb to the top.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <Link to="/register" className="w-full sm:w-auto">
                            <InteractiveButton className="w-full sm:w-auto !px-8 !py-4 !text-base shadow-[0_0_40px_-10px_rgba(110,68,255,0.4)]">
                                Start Your Streak <ArrowRight className="w-4 h-4" />
                            </InteractiveButton>
                        </Link>
                        <button className="w-full sm:w-auto group flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Play className="w-3 h-3 fill-white ml-0.5" />
                            </div>
                            <span>Watch Protocol</span>
                        </button>
                    </div>

                    {/* Code Snippet Decoration */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="mt-16 sm:mt-24 p-1 rounded-xl bg-gradient-to-b from-white/10 to-transparent w-full max-w-3xl glass-panel transform rotate-x-12 perspective-1000 hidden md:block"
                    >
                        <div className="bg-surface/90 rounded-lg p-4 font-mono text-sm text-left overflow-hidden relative">
                            <div className="flex gap-2 mb-4">
                                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                            </div>
                            <div className="text-gray-400">
                                <span className="text-purple-400">const</span> <span className="text-blue-400">cadet</span> = <span className="text-purple-400">await</span> Antigravity.<span className="text-yellow-400">evolve</span>({'{'}
                                <br />&nbsp;&nbsp;skills: [<span className="text-green-400">'DSA'</span>, <span className="text-green-400">'System Design'</span>],
                                <br />&nbsp;&nbsp;consistency: <span className="text-orange-400">100</span>%
                                <br />{'}'});
                                <br />
                                <span className="text-gray-500">// Output: Offer received from MAANG</span>
                            </div>
                            <div className="absolute top-0 right-0 p-4">
                                <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-500 text-xs rounded">Passing Tests</div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-500"
                >
                    <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center p-1">
                        <div className="w-1 h-2 bg-white/50 rounded-full" />
                    </div>
                </motion.div>
            </section>

            {/* SOCIAL PROOF */}
            <section className="py-12 border-y border-white/5 bg-surface/30">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-sm font-mono text-gray-500 mb-8 uppercase tracking-widest">Alumni Deployed At</p>
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {CompanyLogos.map((logo, idx) => (
                            <div key={idx} className="flex items-center gap-2 group cursor-default">
                                <div className="w-8 h-8 rounded bg-current opacity-20 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: logo.color }}></div>
                                <span className="font-bold text-xl text-gray-300 group-hover:text-white transition-colors">{logo.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BENTO GRID FEATURES */}
            <section id="features" className="py-32 relative">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-void to-void pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <ScrollSection className="text-center mb-20">
                        <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">Built for <span className="text-gradient-primary">High Performance</span></h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">Leave generic tutorials behind. Train with a system designed to simulate the intensity of real technical assessments.</p>
                    </ScrollSection>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[200px]">

                        {/* Card 1: AI Analysis (Large) */}
                        <ScrollSection className="md:col-span-2 lg:col-span-2 row-span-2 glass-card p-8 flex flex-col justify-between group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-[200px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Code2 />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Automated Code Review</h3>
                                <p className="text-gray-400">Instant, line-by-line feedback on your solutions via our neural engine. Optimization tips included.</p>
                            </div>

                            <div className="mt-8 bg-black/50 rounded-lg border border-white/5 p-4 font-mono text-xs text-gray-400 overflow-hidden relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
                                <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                                    <span>Analysis.log</span>
                                    <span className="text-green-400 text-[10px] px-2 py-0.5 bg-green-500/10 rounded">OPTIMIZED</span>
                                </div>
                                <p className="text-red-400 line-through opacity-50">O(n^2) - Nested loops detected</p>
                                <p className="text-green-400 mt-1">{'>'} Refactoring to O(n) using Hash Map...</p>
                                <p className="text-blue-300 mt-1">{'>'} Memory usage reduced by 40%</p>
                            </div>
                        </ScrollSection>

                        {/* Card 2: Streak (Tall) */}
                        <ScrollSection className="md:col-span-1 lg:col-span-1 row-span-2 glass-card p-6 flex flex-col items-center justify-center text-center relative group">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-orange-500/5 group-hover:to-orange-500/10 transition-all duration-500" />
                            <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6 relative">
                                <Zap className="w-10 h-10 fill-current animate-pulse-slow" />
                                <div className="absolute inset-0 border border-orange-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                            </div>
                            <div className="text-5xl font-display font-bold text-white mb-2">14</div>
                            <div className="text-sm font-mono text-orange-400 uppercase tracking-widest mb-4">Day Streak</div>
                            <p className="text-xs text-gray-500">Consistency is the only algorithm that matters.</p>
                        </ScrollSection>

                        {/* Card 3: Interviews */}
                        <ScrollSection className="md:col-span-1 lg:col-span-1 row-span-1 glass-card p-6 relative overflow-hidden group">
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <Mic />
                                </div>
                                <div className="px-2 py-1 bg-white/5 rounded text-[10px] uppercase font-bold text-gray-400">Beta</div>
                            </div>
                            <h3 className="text-lg font-bold mt-4">AI Mock Interviews</h3>
                        </ScrollSection>

                        {/* Card 4: Leaderboard */}
                        <ScrollSection className="md:col-span-1 lg:col-span-1 row-span-1 glass-card p-6 relative overflow-hidden group">
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                                    <Trophy />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold mt-4">Global Rank</h3>
                            <p className="text-xs text-gray-400 mt-2">Compete with the top 1%.</p>
                        </ScrollSection>

                    </div>
                </div>
            </section>

            {/* SKILL TREE VISUAL */}
            <section className="py-32 bg-nebula relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <ScrollSection>
                        <h2 className="font-display text-4xl font-bold mb-6">Visualize Your <br /><span className="text-primary">Evolution</span></h2>
                        <ul className="space-y-6">
                            {[
                                { title: "Data Structures", desc: "Master Arrays, Trees, Graphs", color: "bg-blue-500" },
                                { title: "Algorithms", desc: "Dynamic Programming, Greedy, Backtracking", color: "bg-purple-500" },
                                { title: "System Design", desc: "Scalability, Load Balancing, Caching", color: "bg-green-500" }
                            ].map((item, idx) => (
                                <li key={idx} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${item.color} shadow-[0_0_10px_currentColor]`} />
                                        {idx !== 2 && <div className="w-0.5 h-full bg-white/10 my-2 group-hover:bg-white/30 transition-colors" />}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-200 group-hover:text-white transition-colors">{item.title}</h4>
                                        <p className="text-gray-500 text-sm">{item.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ScrollSection>

                    <ScrollSection className="relative h-[400px] glass-panel border border-white/5 flex items-center justify-center">
                        <div className="text-center">
                            <div className="inline-block relative">
                                <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative z-10 bg-void">
                                    <span className="text-4xl font-bold">85%</span>
                                </div>
                                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-[spin_3s_linear_infinite]" />
                                <div className="absolute -inset-4 border border-white/10 rounded-full animate-pulse-slow" />
                            </div>
                            <p className="mt-6 font-mono text-primary">MASTERY LEVEL: ELITE</p>
                        </div>
                    </ScrollSection>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="py-32 relative text-center">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />
                </div>

                <div className="relative z-10 max-w-3xl mx-auto px-6">
                    <h2 className="font-display text-5xl md:text-7xl font-bold mb-8">Ready to <span className="text-white">Execute?</span></h2>
                    <p className="text-xl text-gray-400 mb-12">Join the network of developers building the future. Your terminal awaits.</p>

                    <Link to="/register">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="group relative px-12 py-6 bg-white text-black font-bold text-lg rounded-full overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] transition-shadow"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Launch Cadet Program <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                        </motion.button>
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-surface border-t border-white/5 py-12 px-6 font-mono text-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Terminal className="w-4 h-4" />
                        <span>ANTIGRAVITY SYSTEMS v2.0</span>
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
