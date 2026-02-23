import React, { useMemo } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Trophy, Target, ArrowRight, Activity, BrainCircuit, Wrench, Check, AlertTriangle, Flame } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface DailySession {
    _id: string;
    cluster: string;
    topic: string;
    reason: string;
    behavioralState: string;
    streakMeta: { streakDays: number };
}

export const DailyHomeCard: React.FC = () => {
    const { data: session, isLoading, error } = useSWR<DailySession>(
        `${import.meta.env.VITE_API_BASE_URL}/api/daily/session`,
        fetcher,
        { dedupingInterval: 60000 * 60, revalidateOnFocus: false } // Cache for 1 hour
    );

    const { data: dashData } = useSWR<any>(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`,
        fetcher
    );

    if (isLoading) {
        return (
            <Card className="border-primary/50 bg-primary/5 mb-8 animate-pulse shadow-lg">
                <CardContent className="h-48 flex items-center justify-center">
                    <p className="text-primary font-medium">Assembling today's lesson...</p>
                </CardContent>
            </Card>
        );
    }

    if (error || !session) return null;

    const streak = session.streakMeta?.streakDays || 0;
    const state = session.behavioralState || 'COLD_START';
    const momentumScore = Math.min(streak * 10, 100);

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (momentumScore / 100) * circumference;

    const velocityHistory = dashData?.behavior?.velocityHistory || [];

    const timeline = useMemo(() => {
        const days = [];
        const today = new Date();
        const historyMap = new Map();
        velocityHistory.forEach((v: any) => historyMap.set(v.date, v));

        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const record = historyMap.get(dateStr);
            let status = 'missed';
            if (record) status = record.avgDelta >= 2.0 ? 'completed' : 'low-performance';

            days.push({
                date: dateStr,
                dayLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).split(' ')[0], // just month/day or narrow day? Let's do narrow weekday
                weekday: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                status
            });
        }
        return days;
    }, [velocityHistory]);

    return (
        <Card className="border-primary/50 bg-gradient-to-br from-card to-card/50 mb-8 overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <div className="absolute -top-6 -right-6 p-4 opacity-5 rotate-12 pointer-events-none">
                <Trophy size={160} />
            </div>

            {/* Smart Messaging Banner */}
            {state === 'OVERLOAD' && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-2 text-red-600 text-sm font-medium">
                    <BrainCircuit size={16} /> Avoid burnout. Take a calm, un-timed review session today.
                </div>
            )}
            {state === 'PLATEAU' && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center gap-2 text-amber-600 text-sm font-medium">
                    <Activity size={16} /> You're on a plateau. Focus on the explanation slowly today to break through.
                </div>
            )}
            {state === 'MAINTENANCE' && (
                <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2 flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <Wrench size={16} /> Maintenance Mode: Your core skills are strong. Want to take a Mock instead?
                </div>
            )}

            <CardHeader className="pb-3 px-6 pt-6">
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        <Target className="text-primary" size={24} />
                        Daily Training Ready
                    </CardTitle>
                    <Badge variant="outline" className="border-primary/50 text-primary capitalize">
                        {session.reason.replace(/_/g, ' ')}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">

                    {/* Momentum Meter */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                                <circle className="text-muted/30 stroke-current" strokeWidth="6" cx="50" cy="50" r={radius} fill="transparent" />
                                <circle
                                    stroke="currentColor"
                                    className="text-primary transition-all duration-1000 ease-out"
                                    strokeWidth="6"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    cx="50" cy="50" r={radius} fill="transparent"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black">{streak}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Streak</span>
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold">{state === 'RECOVERY' ? 'Recovering...' : 'Momentum Active'}</p>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{state.replace('_', ' ')}</span>
                        </div>
                    </div>

                    {/* Topic Info */}
                    <div className="flex-1 flex flex-col items-center justify-center md:items-start text-center md:text-left">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">{session.cluster}</p>
                        <h3 className="text-2xl font-extrabold text-foreground">{session.topic}</h3>
                    </div>

                    {/* CTA */}
                    <div className="shrink-0 pt-4 md:pt-0">
                        <Link to={`/today?topic=${encodeURIComponent(session.topic)}`}>
                            <Button size="lg" className="group shadow-md px-8 py-6 h-auto text-lg rounded-xl">
                                Start Session
                                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>

                </div>
            </CardContent>

            {/* Daily History Strip: 14-day tracking */}
            <div className="border-t border-border/50 bg-muted/10 px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                        <Activity size={16} /> 14-Day Trajectory
                    </div>

                    <div className="flex items-center justify-end w-full overflow-x-auto scrollbar-none gap-2 pb-2 md:pb-0">
                        {timeline.map((day, i) => (
                            <div
                                key={i}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border w-10 shrink-0 transition-colors ${day.status === 'completed' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                                        day.status === 'low-performance' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                            'bg-background border-border text-muted-foreground'
                                    }`}
                                title={`${day.date}: ${day.status}`}
                            >
                                {day.status === 'completed' ? <Check size={16} /> :
                                    day.status === 'low-performance' ? <Flame size={16} className="opacity-70" /> :
                                        <AlertTriangle size={16} className="opacity-30" />}
                                <span className="text-[10px] uppercase font-bold mt-1 opacity-70">{day.weekday}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </Card>
    );
};
