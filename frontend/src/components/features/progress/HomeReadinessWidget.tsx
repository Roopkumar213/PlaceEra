import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Badge } from '../../ui/badge';
import { ArrowRight, Loader2, TrendingUp } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.data);
};

const getBadgeColor = (classification: string) => {
    switch (classification) {
        case 'Ready': return 'bg-green-500 hover:bg-green-600';
        case 'Improving': return 'bg-yellow-500 hover:bg-yellow-600';
        case 'Developing': return 'bg-orange-500 hover:bg-orange-600';
        default: return 'bg-red-500 hover:bg-red-600';
    }
};

export const HomeReadinessWidget: React.FC = () => {
    const { data, error, isLoading } = useSWR(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/readiness`,
        fetcher
    );

    if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground animate-pulse"><Loader2 size={16} className="animate-spin" /> Loading Readiness...</div>;

    if (error) return (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded mb-4">
            <span className="text-xs font-semibold">Error loading readiness. Try logging out.</span>
        </div>
    );

    if (!data) return null;

    return (
        <div className="flex items-center gap-4 bg-card/50 border border-border/50 p-3 rounded-lg backdrop-blur-sm mb-4">
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                    {data?.score}%
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Current Readiness</span>
                    <Badge className={`w-fit text-[10px] px-2 py-0 h-5 ${getBadgeColor(data?.classification)} border-0`}>
                        {data?.classification}
                    </Badge>
                </div>
            </div>

            <div className="w-px h-8 bg-border/50 mx-2 hidden sm:block"></div>

            <Link to="/progress" className="hidden sm:flex items-center gap-1 text-sm text-primary hover:underline font-medium group">
                View Trends <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            {/* Mobile only icon */}
            <Link to="/progress" className="sm:hidden text-primary">
                <TrendingUp size={20} />
            </Link>
        </div>
    );
};
