import React, { useMemo } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Flame, Star, Award, Zap, CalendarDays } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface VelocityPoint { date: string; avgDelta: number; count: number; }
interface BehaviorData {
    streakDays: number;
    behavioralState: 'OPTIMAL' | 'PLATEAU' | 'OVERLOAD' | 'COLD_START' | 'RECOVERY';
    velocityHistory: VelocityPoint[];
}
interface DashboardResponse {
    streak: number;
    behavior?: BehaviorData;
}
interface FullYearStat { date: string; count: number; avgDelta: number; }
interface ConsistencyResponse {
    fullYearStats: FullYearStat[];
}

const STATE_COLORS = {
    OPTIMAL: { stroke: '#22c55e', text: 'text-green-500', bg: 'bg-green-500', border: 'border-green-500' },
    PLATEAU: { stroke: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500' },
    OVERLOAD: { stroke: '#ef4444', text: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500' },
    COLD_START: { stroke: '#3b82f6', text: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500' },
    RECOVERY: { stroke: '#a855f7', text: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-500' },
};

const Consistency: React.FC = () => {
    const { data: dashData, isLoading: dashLoading } = useSWR<DashboardResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`,
        fetcher,
        { dedupingInterval: 60000 }
    );

    const { data: yearData, isLoading: yearLoading } = useSWR<ConsistencyResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/consistency`,
        fetcher,
        { dedupingInterval: 60000 }
    );

    const behavior = dashData?.behavior;
    const streak = behavior?.streakDays ?? dashData?.streak ?? 0;
    const state = behavior?.behavioralState ?? 'COLD_START';
    const velocityHistory = behavior?.velocityHistory ?? [];

    const timeline = useMemo(() => {
        const days = [];
        const today = new Date();
        const historyMap = new Map<string, VelocityPoint>();
        velocityHistory.forEach(v => historyMap.set(v.date, v));

        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const record = historyMap.get(dateStr);
            let status = 'missed';
            if (record) status = record.avgDelta >= 2.0 ? 'completed' : 'low-performance';

            days.push({
                date: dateStr,
                dayLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                status
            });
        }
        return days;
    }, [velocityHistory]);

    const badges = useMemo(() => {
        return [
            { id: 'b1', name: 'Starter', icon: <Star size={14} />, unlocked: streak >= 1 },
            { id: 'b2', name: '3-Day Fire', icon: <Flame size={14} />, unlocked: streak >= 3 },
            { id: 'b3', name: '7-Day Core', icon: <Award size={14} />, unlocked: streak >= 7 },
            { id: 'b4', name: 'Momentum', icon: <Zap size={14} />, unlocked: streak >= 14 },
        ];
    }, [streak]);

    // Calendar Cells
    const { cells, statsMap } = useMemo(() => {
        const map = new Map<string, FullYearStat>();
        if (yearData?.fullYearStats) {
            yearData.fullYearStats.forEach(s => map.set(s.date, s));
        }

        const today = new Date();
        const datesArray = [];
        for (let i = 364; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            datesArray.push(d.toISOString().split('T')[0]);
        }

        let firstDate = new Date(datesArray[0]);
        let startDay = firstDate.getDay();
        const paddedCells = [...Array(startDay).fill(null), ...datesArray];

        return { cells: paddedCells, statsMap: map };
    }, [yearData]);

    if (dashLoading || yearLoading) {
        return (
            <PageContainer>
                <div className="animate-pulse space-y-8 mt-6">
                    <div className="h-64 bg-card rounded-2xl"></div>
                    <div className="h-64 bg-card rounded-2xl"></div>
                </div>
            </PageContainer>
        );
    }

    const momentumScore = Math.min(streak * 10, 100);
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (momentumScore / 100) * circumference;
    const colorCfg = STATE_COLORS[state as keyof typeof STATE_COLORS] || STATE_COLORS.COLD_START;

    return (
        <PageContainer>
            <div className="flex items-center gap-3 mb-6 mt-4">
                <Flame size={28} className="text-primary" />
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Consistency Hub</h1>
                    <p className="text-muted-foreground text-sm">Track your execution, velocity, and daily momentum.</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 mb-8">
                {/* 1. Momentum Ring Card */}
                <Card className="lg:col-span-1 border-border/60 shadow-md bg-gradient-to-br from-card to-card/50 overflow-hidden relative rounded-2xl">
                    <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none ${colorCfg.bg}`} />
                    <CardContent className="flex flex-col items-center justify-center p-8 h-full">
                        <div className="relative w-48 h-48 mb-6">
                            <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                                <circle className="text-muted/20 stroke-current" strokeWidth="8" cx="50" cy="50" r={radius} fill="transparent" />
                                <circle
                                    stroke={colorCfg.stroke}
                                    strokeWidth="8"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    cx="50" cy="50" r={radius} fill="transparent"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-5xl font-black tracking-tight">{streak}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-1">Day Streak</span>
                                <span className={`text-[11px] font-bold mt-3 uppercase tracking-widest px-2 py-0.5 rounded-full bg-background border shadow-sm ${colorCfg.text}`}>
                                    {state.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. 14-Day Trajectory & Trophies */}
                <Card className="lg:col-span-2 shadow-md border-border/60 rounded-2xl flex flex-col justify-center p-8">
                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="font-bold text-xl tracking-tight">Recent Momentum</h3>
                            <span className="text-sm font-medium text-muted-foreground">Best Segment: {streak} days</span>
                        </div>

                        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                            {timeline.map((day, i) => {
                                let circleClass = "w-8 h-8 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110";
                                if (day.status === 'completed') {
                                    circleClass += ` ${colorCfg.bg} ${colorCfg.border} shadow-[0_0_12px_rgba(0,0,0,0.15)]`;
                                } else if (day.status === 'low-performance') {
                                    circleClass += ` bg-gradient-to-b from-${colorCfg.bg.replace('bg-', '')} to-transparent ${colorCfg.border} opacity-80`;
                                } else {
                                    circleClass += " border-muted/50 bg-background";
                                }

                                return (
                                    <div key={i} className="flex flex-col items-center gap-2" title={`${day.date}: ${day.status}`}>
                                        <div
                                            className={circleClass}
                                            style={day.status === 'low-performance' ? { background: `linear-gradient(135deg, ${colorCfg.stroke} 50%, transparent 50%)`, borderColor: colorCfg.stroke } : {}}
                                        />
                                        <span className="text-xs text-muted-foreground font-semibold">{day.dayLabel}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm text-foreground/80 mb-3 uppercase tracking-wider">Consistency Trophies</h3>
                        <div className="flex flex-wrap gap-3">
                            {badges.map(badge => (
                                <Badge
                                    key={badge.id}
                                    variant="outline"
                                    className={`py-2 px-4 rounded-lg border text-sm gap-2 transition-all duration-300
                                        ${badge.unlocked
                                            ? 'bg-background shadow-md border-border/80 text-foreground scale-100'
                                            : 'bg-muted/30 border-muted text-muted-foreground/40 grayscale scale-95 opacity-50'}`}
                                >
                                    {React.cloneElement(badge.icon as React.ReactElement<{ className?: string }>, {
                                        className: badge.unlocked ? colorCfg.text : 'text-muted-foreground opacity-50'
                                    })}
                                    {badge.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            {/* 3. Full-Year Activity Calendar Grid */}
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <CalendarDays size={20} className="text-muted-foreground" />
                Annual Consistency
            </h2>
            <Card className="p-6 overflow-x-auto shadow-sm border-border/60 rounded-2xl w-full">
                <div className="min-w-max flex">
                    <div className="flex flex-col gap-[10px] text-xs text-muted-foreground/70 justify-start pt-6 pr-3 font-medium select-none h-[110px]">
                        <span className="h-3.5 flex items-center">Mon</span>
                        <span className="h-3.5 flex items-center">Wed</span>
                        <span className="h-3.5 flex items-center">Fri</span>
                    </div>

                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                        {cells.map((date, i) => {
                            if (!date) return <div key={`pad-${i}`} className="w-[14px] h-[14px]" />;

                            const stat = statsMap.get(date);
                            let bgClass = "bg-muted/20 border-border/30"; // Empty

                            if (stat) {
                                // GitHub-like intensity scaling
                                if (stat.count >= 4) bgClass = "bg-green-600 border-green-700/50 shadow-sm";
                                else if (stat.count >= 2) bgClass = "bg-green-500 border-green-600/50 shadow-sm";
                                else if (stat.count === 1) bgClass = "bg-green-400/80 border-green-500/50";
                            }

                            return (
                                <div
                                    key={date}
                                    className={`w-[14px] h-[14px] rounded-[2px] border ${bgClass} transition-colors hover:border-foreground/40`}
                                    title={`${date} — ${stat ? stat.count : 0} sessions completed`}
                                />
                            );
                        })}
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground font-medium w-full min-w-max">
                    Less
                    <div className="flex gap-[3px]">
                        <div className="w-[14px] h-[14px] rounded-[2px] bg-muted/20 border border-border/30" />
                        <div className="w-[14px] h-[14px] rounded-[2px] bg-green-400/80 border border-green-500/50" />
                        <div className="w-[14px] h-[14px] rounded-[2px] bg-green-500 border border-green-600/50" />
                        <div className="w-[14px] h-[14px] rounded-[2px] bg-green-600 border border-green-700/50" />
                    </div>
                    More
                </div>
            </Card>

        </PageContainer>
    );
};

export default Consistency;
