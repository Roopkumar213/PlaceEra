import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { PageContainer } from '../components/layout/PageContainer';
import { MockTestEngine } from '../components/features/mock/MockTestEngine';
import { FileText, Calendar, Clock, ChevronUp, ChevronDown, Minus } from 'lucide-react';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface MockSession {
    _id: string;
    startedAt: string;
    completedAt: string;
    durationMinutes: number;
    questionCount: number;
    score: number;
    performanceDelta: number;
    subjectBreakdown: Record<string, { correct: number; total: number; score: number }>;
    status: string;
}

const MockHistory: React.FC = () => {
    const { data: history, isLoading, error } = useSWR<MockSession[]>(
        `${import.meta.env.VITE_API_BASE_URL}/api/mock/history`,
        fetcher
    );

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <PageContainer>
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-1">Weekly Mock Tests</h1>
                <p className="text-muted-foreground">
                    Simulate real placement conditions with weighted adaptive questions.
                </p>
            </div>

            {/* Mock Engine */}
            <div className="mb-10">
                <MockTestEngine />
            </div>

            {/* History Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    Past Sessions
                </h2>

                {isLoading && (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                        Failed to load mock history.
                    </div>
                )}

                {!isLoading && !error && (!history || history.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-border rounded-xl bg-card/50">
                        <FileText size={40} className="text-muted-foreground/40" />
                        <p className="text-muted-foreground">No mock tests completed yet.</p>
                        <p className="text-sm text-muted-foreground/60">
                            Take your first mock test above to see your history here.
                        </p>
                    </div>
                )}

                {history && history.length > 0 && (
                    <>
                        {/* Spark line chart: score over time */}
                        <div className="mb-6 rounded-xl border border-border bg-card p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Score Trend</h3>
                            <div className="flex items-end gap-2 h-20">
                                {history.slice().reverse().map((s) => (
                                    <div key={s._id} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className={`w-full rounded-sm transition-all ${s.score >= 70 ? 'bg-green-500' : s.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ height: `${Math.max(4, (s.score / 100) * 72)}px` }}
                                            title={`${s.score}%`}
                                        />
                                        <span className="text-[10px] text-muted-foreground">
                                            {new Date(s.completedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Session cards */}
                        <div className="flex flex-col gap-3">
                            {history.map((session, idx) => {
                                const delta = session.performanceDelta ?? 0;
                                const DeltaIcon = delta > 0 ? ChevronUp : delta < 0 ? ChevronDown : Minus;
                                const deltaColor = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';

                                return (
                                    <div
                                        key={session._id}
                                        className="rounded-xl border border-border bg-card p-5 space-y-4"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar size={13} />
                                                    {formatDate(session.completedAt)}
                                                    <Clock size={13} className="ml-1" />
                                                    {session.durationMinutes}m
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-3xl font-bold ${session.score >= 70 ? 'text-green-500' : session.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                        {session.score}%
                                                    </span>
                                                    <span className={`flex items-center text-sm font-medium ${deltaColor}`}>
                                                        <DeltaIcon size={14} />
                                                        {Math.abs(delta).toFixed(1)} pts
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                                #{history.length - idx}
                                            </span>
                                        </div>

                                        {/* Subject breakdown mini bars */}
                                        {session.subjectBreakdown && Object.keys(session.subjectBreakdown).length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {Object.entries(session.subjectBreakdown).map(([sub, data]) => (
                                                    <div key={sub} className="space-y-1">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span className="truncate">{sub}</span>
                                                            <span>{Math.round(data.score ?? 0)}%</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div
                                                                className={`h-1.5 rounded-full ${(data.score ?? 0) >= 70 ? 'bg-green-500' : (data.score ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                style={{ width: `${Math.round(data.score ?? 0)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </PageContainer>
    );
};

export default MockHistory;
