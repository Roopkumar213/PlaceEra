import React from 'react';
import useSWR from 'swr';
import axios from 'axios';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface VelocityPoint {
    date: string;
    avgDelta: number;
    count: number;
}

interface BehaviorData {
    streakDays: number;
    behavioralState: 'OPTIMAL' | 'PLATEAU' | 'OVERLOAD' | 'COLD_START';
    behavioralMeta: {
        message?: string;
        suggestion?: string;
        todayAttempts?: number;
        avgVelocity?: number;
    };
    velocityHistory: VelocityPoint[];
}

interface DashboardResponse {
    streak: number;
    behavior?: BehaviorData;
}

const STATE_CONFIG = {
    OPTIMAL: {
        emoji: '🚀',
        label: 'Optimal',
        color: 'text-green-500',
        bg: 'bg-green-500/10 border-green-500/30',
        bar: 'bg-green-500'
    },
    PLATEAU: {
        emoji: '📉',
        label: 'Plateau',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10 border-amber-500/30',
        bar: 'bg-amber-500'
    },
    OVERLOAD: {
        emoji: '🧠',
        label: 'Overload',
        color: 'text-red-500',
        bg: 'bg-red-500/10 border-red-500/30',
        bar: 'bg-red-500'
    },
    COLD_START: {
        emoji: '❄️',
        label: 'Inactive',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/30',
        bar: 'bg-blue-400'
    }
};

/**
 * BehavioralStatusWidget
 * Displayed on the Home dashboard.
 * Shows: streak, behavioral state, suggested action, velocity micro-chart.
 */
export const BehavioralStatusWidget: React.FC = () => {
    const { data, isLoading, error } = useSWR<DashboardResponse>(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`,
        fetcher,
        { dedupingInterval: 60000 }
    );

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card/50 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-28" />
                        <div className="h-3 bg-muted rounded w-20" />
                    </div>
                </div>
                <div className="h-12 bg-muted rounded" />
            </div>
        );
    }

    if (error || !data) return null;

    const behavior = data.behavior;
    const streak = behavior?.streakDays ?? data.streak ?? 0;
    const state = behavior?.behavioralState ?? 'OPTIMAL';
    const meta = behavior?.behavioralMeta ?? {};
    const velocity = behavior?.velocityHistory ?? [];
    const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.OPTIMAL;

    // Compute max delta for chart scaling
    const maxDelta = Math.max(...velocity.map(v => v.avgDelta), 1);

    return (
        <div className={`rounded-xl border p-5 space-y-4 ${cfg.bg}`}>
            {/* Header row: Streak + State */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Streak */}
                    <div className="flex flex-col items-center bg-background/60 rounded-lg px-4 py-2 border border-border/50 min-w-[5rem] text-center">
                        <span className="text-2xl leading-none">🔥</span>
                        <span className={`text-xl font-bold mt-1 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                            {streak}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {streak === 1 ? 'Day' : 'Days'}
                        </span>
                    </div>

                    {/* State badge */}
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-lg">{cfg.emoji}</span>
                            <span className={`text-base font-bold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {meta.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{meta.message}</p>
                        )}
                    </div>
                </div>

                {/* Velocity Micro-chart */}
                {velocity.length > 0 && (
                    <div className="hidden sm:flex items-end gap-1 h-10">
                        {velocity.slice(-8).map((v, i) => (
                            <div
                                key={i}
                                className={`w-2 rounded-sm ${cfg.bar} opacity-80`}
                                style={{ height: `${Math.max(4, (v.avgDelta / maxDelta) * 36)}px` }}
                                title={`${v.date}: Δ${v.avgDelta}`}
                            />
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1 self-end">velocity</span>
                    </div>
                )}
            </div>

            {/* Overload Special Banner */}
            {state === 'OVERLOAD' && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                    <p className="text-sm font-semibold text-red-600 mb-1">⚠️ Take a Break</p>
                    <p className="text-xs text-muted-foreground">{meta.suggestion}</p>
                </div>
            )}

            {/* Plateau Suggestion */}
            {state === 'PLATEAU' && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-amber-600">📊 Progress Plateaued</p>
                        {meta.avgVelocity !== undefined && (
                            <span className="text-xs font-mono text-amber-500">
                                Δ{meta.avgVelocity}/attempt
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.suggestion}</p>
                </div>
            )}

            {/* Suggestion for all other states */}
            {(state === 'OPTIMAL' || state === 'COLD_START') && meta.suggestion && (
                <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-3">
                    💡 {meta.suggestion}
                </p>
            )}
        </div>
    );
};
