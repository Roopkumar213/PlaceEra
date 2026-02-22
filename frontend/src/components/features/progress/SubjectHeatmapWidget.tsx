import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { Flame } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface SubjectDetail {
    mastery: number;
    weight: number;
}

/**
 * SubjectHeatmapWidget — Visual heatmap of subject readiness.
 * Highlights weakest subject in red, others scaled to mastery.
 * Data from GET /api/progress/readiness -> details
 */
export const SubjectHeatmapWidget: React.FC = () => {
    const { data, isLoading, error } = useSWR(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/readiness`,
        fetcher,
        { dedupingInterval: 60000 }
    );

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card/50 p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-40 mb-4" />
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg" />)}
                </div>
            </div>
        );
    }

    if (error || !data?.details) return null;

    const entries = Object.entries(data.details as Record<string, SubjectDetail>)
        .sort(([, a], [, b]) => a.mastery - b.mastery);

    if (entries.length === 0) return null;

    const weakestSubject = entries[0][0];

    const getHeatColor = (mastery: number, isWeakest: boolean): string => {
        if (isWeakest) return 'from-red-500/20 to-red-500/10 border-red-500/40';
        if (mastery >= 80) return 'from-green-500/20 to-green-500/10 border-green-500/40';
        if (mastery >= 60) return 'from-yellow-500/20 to-yellow-500/10 border-yellow-500/40';
        if (mastery >= 40) return 'from-orange-500/20 to-orange-500/10 border-orange-500/40';
        return 'from-red-500/20 to-red-500/10 border-red-500/40';
    };

    const getBarColor = (mastery: number, isWeakest: boolean): string => {
        if (isWeakest) return 'bg-red-500';
        if (mastery >= 80) return 'bg-green-500';
        if (mastery >= 60) return 'bg-yellow-500';
        if (mastery >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    return (
        <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Flame size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">Subject Readiness Heatmap</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                    Weakest: <span className="text-red-500 font-medium">{weakestSubject}</span>
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {entries.map(([subject, detail]) => {
                    const isWeakest = subject === weakestSubject;
                    return (
                        <div
                            key={subject}
                            className={`relative rounded-lg border bg-gradient-to-b p-3 ${getHeatColor(detail.mastery, isWeakest)} transition-all`}
                        >
                            {isWeakest && (
                                <div className="absolute -top-1.5 -right-1.5">
                                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                        WEAKEST
                                    </span>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground truncate mb-1">{subject}</p>
                            <p className={`text-xl font-bold ${isWeakest ? 'text-red-500' : ''}`}>
                                {Math.round(detail.mastery)}%
                            </p>
                            <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
                                <div
                                    className={`h-1 rounded-full transition-all ${getBarColor(detail.mastery, isWeakest)}`}
                                    style={{ width: `${detail.mastery}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
