import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
    LayoutDashboard,
    BookOpen,
    Target,
    Settings,
    LogOut,
    Menu,
    ClipboardList,
    BarChart2,
    Flame,
    Sparkles,
    UserCircle2
} from 'lucide-react';

export const Header: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);

    // Watch scroll for dynamic header elevation
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navItems = [
        { label: 'Today', path: '/today', icon: Target },
        { label: 'Curriculum', path: '/curriculum', icon: BookOpen },
        { label: 'Progress', path: '/progress', icon: LayoutDashboard },
        { label: 'Consistency', path: '/consistency', icon: Flame },
        { label: 'Mock', path: '/mock', icon: ClipboardList },
        { label: 'Analytics', path: '/analytics', icon: BarChart2 },
    ];

    return (
        <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
            : 'bg-background/50 backdrop-blur-md border-b border-transparent'}`}>

            {/* Glossy top highlight line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50" />

            <div className="container max-w-7xl mx-auto flex h-16 md:h-20 items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-8 lg:gap-12">

                    {/* Brand Logo */}
                    <Link to="/" className="group relative flex items-center gap-2 font-display font-extrabold text-2xl tracking-tight transition-transform hover:scale-105 active:scale-95">
                        <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-indigo-500 group-hover:from-indigo-400 group-hover:to-primary transition-all duration-500">
                            ELEVARE
                        </span>
                        <span className="text-foreground relative flex items-start">
                            .AI <Sparkles size={12} className="text-yellow-500 absolute -top-1 -right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-0 group-hover:scale-100" />
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/20 border border-white/5 backdrop-blur-sm">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                        ? 'text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                        }`}
                                >
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70 z-0" />
                                    )}
                                    <item.icon size={16} className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-md' : 'scale-100'}`} />
                                    <span className="relative z-10 tracking-wide">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* User & Actions */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4 pl-6 border-l border-border/50">
                        {/* Premium User Profile Pill */}
                        <div className="flex items-center gap-3 py-1.5 px-3 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer group">
                            <div className="flex flex-col items-end justify-center">
                                <span className="text-xs font-extrabold tracking-wide uppercase leading-tight text-foreground/90 group-hover:text-primary transition-colors">
                                    {user?.name || 'Neural Link'}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
                                    Candidate ID
                                </span>
                            </div>
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 group-hover:border-primary/50 transition-colors shadow-inner overflow-hidden">
                                <UserCircle2 size={24} className="text-primary/80 group-hover:text-primary transition-colors z-10" />
                                <div className="absolute inset-0 bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>

                        {/* Setting Links */}
                        <Link to="/settings" className="relative group">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors relative overflow-hidden">
                                <Settings size={18} className="relative z-10 transition-transform group-hover:rotate-45 duration-500" />
                            </Button>
                        </Link>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={logout}
                            className="rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                            <LogOut size={18} />
                        </Button>
                    </div>

                    {/* Mobile Menu Trigger */}
                    <Button variant="outline" size="icon" className="md:hidden rounded-xl border-white/10 bg-muted/20 hover:bg-primary/20 hover:border-primary/30 hover:text-primary transition-colors">
                        <Menu size={20} />
                    </Button>
                </div>
            </div>
        </header>
    );
};
