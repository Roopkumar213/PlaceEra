import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { AlertTriangle, BookOpen } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

/**
 * RevisionFocusPanel — Displays topics currently flagged for revision.
 * Pulled from GET /api/progress/dashboard -> recentActivity 
 * and separately infers from weakTopics mastery < 60.
 */
export const RevisionFocusPanel: React.FC = () => {
    const { data: dashboard, isLoading } = useSWR(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`,
        fetcher,
        { dedupingInterval: 60000 }
    );

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card/50 p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-32 mb-3" />
                <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
                </div>
            </div>
        );
    }

    // Filter weakTopics that are flagged for revision (mastery < 60)
    const weakTopics: Array<{ topic: string; mastery: number; subject?: string }> =
        dashboard?.weakTopics?.filter((t: any) => t.mastery < 60) || [];

    if (weakTopics.length === 0) return null;

    return (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-orange-600">Revision Focus</h3>
                <span className="ml-auto text-xs text-orange-500/70">Topics below 60% mastery</span>
            </div>
            <div className="space-y-2">
                {weakTopics.slice(0, 5).map((t: any) => (
                    <div
                        key={t.topic}
                        className="flex items-center justify-between bg-card/80 rounded-lg px-4 py-3 border border-orange-500/20"
                    >
                        <div className="flex items-center gap-3">
                            <BookOpen size={14} className="text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{t.topic}</p>
                                {t.subject && (
                                    <p className="text-xs text-muted-foreground">{t.subject}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-1.5 rounded-full bg-orange-500"
                                    style={{ width: `${t.mastery}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-orange-500 min-w-[2.5rem] text-right">
                                {Math.round(t.mastery)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            {weakTopics.length > 5 && (
                <p className="text-xs text-muted-foreground text-right">
                    +{weakTopics.length - 5} more topics need attention
                </p>
            )}
        </div>
    );
};
