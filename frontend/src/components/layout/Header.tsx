import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
    LayoutDashboard,
    BookOpen,
    Target,
    Settings,
    LogOut,
    Menu
} from 'lucide-react';


export const Header: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { label: 'Today', path: '/today', icon: Target },
        { label: 'Curriculum', path: '/curriculum', icon: BookOpen },
        { label: 'Progress', path: '/progress', icon: LayoutDashboard },
    ];

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
                        <span className="text-primary">ELEVARE</span>
                        <span className="text-foreground">.AI</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 transition-colors hover:text-foreground ${location.pathname === item.path ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                            >
                                <item.icon size={16} />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium leading-none">{user?.name}</span>
                            <span className="text-xs text-muted-foreground">Candidate</span>
                        </div>
                        <Link to="/settings">
                            <Button variant="ghost" size="icon">
                                <Settings size={18} />
                            </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={logout}>
                            <LogOut size={18} />
                        </Button>
                    </div>

                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu size={20} />
                    </Button>
                </div>
            </div>
        </header>
    );
};
