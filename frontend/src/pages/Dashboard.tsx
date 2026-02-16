import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
    Activity, BookOpen, BrainCircuit, Calendar, CheckCircle2,
    Code2, Flame, LayoutDashboard, LineChart, LogOut, Target, Trophy, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// -- Mock Data for Dashboard --
const STREAK_DAYS = [true, true, true, false, true, true, false]; // Last 7 days
const WEAK_AREAS = [
    { topic: "Dynamic Programming", score: 45 },
    { topic: "Graph Theory", score: 52 },
    { topic: "System Design", score: 60 }
];
const DAILY_TASKS = [
    { id: 1, type: 'quiz', title: "Morning Aptitude Drill", desc: "10 Questions • 15 Mins", complete: true },
    { id: 2, type: 'code', title: "Daily LeetCode Challenge", desc: "Two Sum II • Medium", complete: false },
    { id: 3, type: 'review', title: "Revise: Hash Maps", desc: "Spaced Repetition due", complete: false }
];

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    const handleLogout = () => {
        logout();
        navigate('/'); // Redirect to Home
    };

    // Sidebar Navigation Item
    const NavItem = ({ icon: Icon, label, id, onClick }: any) => (
        <button
            onClick={() => onClick(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === id
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
        >
            <Icon size={18} />
            <span className="font-medium text-sm">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-void flex text-gray-200 font-sans selection:bg-primary/30">

            {/* --- SIDEBAR --- */}
            <aside className="w-64 fixed inset-y-0 left-0 z-50 bg-surface/50 backdrop-blur-xl border-r border-white/5 hidden md:flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold font-mono">E</div>
                    <span className="font-display font-bold text-lg tracking-wide text-white">ELEVARE</span>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    <p className="px-4 text-xs font-mono text-gray-500 mb-2 uppercase tracking-wider">Dashboard</p>
                    <NavItem icon={LayoutDashboard} label="Overview" id="overview" onClick={setActiveTab} />
                    <NavItem icon={BookOpen} label="Curriculum" id="curriculum" onClick={setActiveTab} />
                    <NavItem icon={BrainCircuit} label="Adaptive Quiz" id="quiz" onClick={setActiveTab} />
                    <NavItem icon={Code2} label="Code Arena" id="code" onClick={setActiveTab} />

                    <p className="px-4 text-xs font-mono text-gray-500 mt-8 mb-2 uppercase tracking-wider">Analytics</p>
                    <NavItem icon={LineChart} label="Performance" id="performance" onClick={setActiveTab} />
                    <NavItem icon={Target} label="Goals" id="goals" onClick={setActiveTab} />
                </div>

                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">Tier-3 Cadet</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 p-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 relative overflow-x-hidden">
                {/* Header (Mobile) */}
                <header className="md:hidden flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-white font-bold">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">E</div>
                        ELEVARE
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400"><LogOut size={20} /></button>
                </header>

                {/* Dashboard View */}
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* 1. Welcome & High-Level Stats */}
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-display font-bold text-white mb-1">
                                Ready to train, <span className="text-gradient-primary">{user?.name?.split(' ')[0] || 'Cadet'}</span>?
                            </h1>
                            <p className="text-gray-400">Your daily intelligent briefing is ready.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="glass-panel px-4 py-2 flex items-center gap-2">
                                <Flame className="text-orange-500 fill-orange-500/20" size={18} />
                                <span className="font-mono font-bold text-white">12</span>
                                <span className="text-xs text-gray-500">Day Streak</span>
                            </div>
                            <div className="glass-panel px-4 py-2 flex items-center gap-2">
                                <Trophy className="text-yellow-500" size={18} />
                                <span className="font-mono font-bold text-white">#42</span>
                                <span className="text-xs text-gray-500">Global Rank</span>
                            </div>
                        </div>
                    </header>

                    {/* 2. Mandatory Daily Tasks */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Calendar className="text-primary" size={18} />
                                Today's Protocol
                            </h2>
                            <span className="text-xs text-gray-500 font-mono">33% COMPLETE</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {DAILY_TASKS.map((task) => (
                                <motion.div
                                    key={task.id}
                                    whileHover={{ y: -2 }}
                                    className={`glass-card p-5 border-l-4 ${task.complete ? 'border-l-green-500 opacity-60' : 'border-l-primary'} relative overflow-hidden group cursor-pointer`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${task.complete ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-gray-300'}`}>
                                            {task.type === 'quiz' && <BrainCircuit size={18} />}
                                            {task.type === 'code' && <Code2 size={18} />}
                                            {task.type === 'review' && <Activity size={18} />}
                                        </div>
                                        {task.complete && <CheckCircle2 className="text-green-500" size={20} />}
                                    </div>
                                    <h3 className="font-bold text-white mb-1">{task.title}</h3>
                                    <p className="text-xs text-gray-400 mb-4">{task.desc}</p>

                                    {!task.complete && (
                                        <button className="w-full py-2 rounded-lg bg-white/5 hover:bg-primary hover:text-white text-xs font-mono transition-colors border border-white/5">
                                            INITIATE
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* 3. Analytics / Weak Areas */}
                        <section className="lg:col-span-2 glass-panel p-6">
                            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                <Target className="text-red-500" size={18} />
                                Detected Weak Zones
                            </h2>
                            <p className="text-sm text-gray-400 mb-6">
                                Based on your recent quizzes, our AI recommends focusing on these topics
                                to improve your placement probability.
                            </p>
                            <div className="space-y-4">
                                {WEAK_AREAS.map((item, idx) => (
                                    <div key={idx} className="group">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-300 group-hover:text-white transition-colors">{item.topic}</span>
                                            <span className="font-mono text-red-400">{item.score}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                                style={{ width: `${item.score}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-end mt-1">
                                            <button className="text-[10px] text-primary hover:text-white hover:underline">
                                                Generate Practice Set →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 4. Consistency Tracker */}
                        <section className="glass-panel p-6 flex flex-col">
                            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                <Zap className="text-yellow-500" size={18} />
                                Consistency Audio
                            </h2>
                            <div className="flex-1 flex items-center justify-center">
                                <div className="grid grid-cols-7 gap-2">
                                    {STREAK_DAYS.map((status, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center border ${status
                                                    ? 'bg-green-500/20 border-green-500/50 text-green-500'
                                                    : 'bg-white/5 border-white/10 text-gray-600'
                                                    }`}
                                            >
                                                {status && <CheckCircle2 size={14} />}
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-500">
                                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/5 text-center">
                                <p className="text-xs text-gray-400">
                                    You are in the top <span className="text-white font-bold">12%</span> of your batch.
                                    <br />Keep it up to reach Tier-1 eligibility.
                                </p>
                            </div>
                        </section>
                    </div>

                    {/* 5. Recommended Resources / Learning Path */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <BookOpen className="text-blue-500" size={18} />
                            Next in Curriculum
                        </h2>
                        <div className="glass-panel p-1 rounded-xl flex flex-col md:flex-row gap-4 bg-surface/30">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex-1 p-4 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <span className="font-bold font-mono">0{i}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-200 group-hover:text-white">Module {i}: Advanced Arrays</h4>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">Deep dive into sliding window technique and two-pointer approach.</p>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
};

export default Dashboard;
