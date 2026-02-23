import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import {
    ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus,
    Target, Zap, AlertTriangle, BarChart2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface TrendPoint { date: string; score: number; performanceDelta: number }
interface WeakestTopic { topic: string; subject: string; avgScore: number; occurrences: number }
interface DiffEntry { avgScore: number; sessions: number }
interface Analytics {
    totalSessions: number;
    averageScore: number;
    bestScore: number;
    latestScore: number;
    improvementTrend: TrendPoint[];
    weakestRecurringTopic: WeakestTopic | null;
    difficultyAccuracy: Record<string, DiffEntry>;
    percentileHistory: { date: string; percentile: number | null; score: number }[];
}

const DIFF_COLOR: Record<string, string> = {
    Easy: 'bg-green-500',
    Medium: 'bg-yellow-500',
    Hard: 'bg-red-500'
};

const DIFF_TEXT: Record<string, string> = {
    Easy: 'text-green-500',
    Medium: 'text-yellow-500',
    Hard: 'text-red-500'
};

function DeltaIcon({ delta }: { delta: number }) {
    if (delta > 1) return <TrendingUp size={14} className="text-green-500" />;
    if (delta < -1) return <TrendingDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-muted-foreground" />;
}

const MockPerformanceReport: React.FC = () => {
    const { data, isLoading, error } = useSWR<Analytics>(
        `${import.meta.env.VITE_API_BASE_URL}/api/mock/analytics`,
        fetcher,
        { dedupingInterval: 30000 }
    );

    if (isLoading) {
        return (
            <PageContainer>
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <AlertTriangle size={40} className="text-destructive" />
                    <p className="text-muted-foreground">Could not load analytics. Please try again.</p>
                </div>
            </PageContainer>
        );
    }

    if (!data || data.totalSessions === 0) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <BarChart2 size={48} className="text-muted-foreground" />
                    <h2 className="text-xl font-semibold">No Mock History Yet</h2>
                    <p className="text-muted-foreground max-w-sm">
                        Complete at least one mock test to see your performance analytics.
                    </p>
                    <Link to="/mock">
                        <button className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                            Start Mock Test
                        </button>
                    </Link>
                </div>
            </PageContainer>
        );
    }

    const trend = data.improvementTrend ?? [];
    const maxScore = 100;

    return (
        <PageContainer>
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link to="/mock" className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Mock Performance Report</h1>
                    <p className="text-sm text-muted-foreground">{data.totalSessions} session{data.totalSessions !== 1 ? 's' : ''} completed</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Average Score', value: `${data.averageScore}%`, icon: Target, highlight: false },
                    { label: 'Best Score', value: `${data.bestScore}%`, icon: Trophy, highlight: data.bestScore === 100 },
                    { label: 'Latest Score', value: `${data.latestScore}%`, icon: Zap, highlight: false },
                    { label: 'Sessions', value: String(data.totalSessions), icon: BarChart2, highlight: false }
                ].map(({ label, value, icon: Icon, highlight }) => (
                    <Card key={label} className={highlight ? 'border-yellow-500/40 bg-yellow-500/5' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                            <Icon size={16} className={highlight ? 'text-yellow-500' : 'text-primary'} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${highlight ? 'text-yellow-500' : ''}`}>{value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Score Trend Chart */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Score Trend — Last {trend.length} Sessions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {trend.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No trend data available.</p>
                            ) : (
                                <div className="flex items-end gap-2 h-32">
                                    {trend.map((pt, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                            <div className="relative w-full flex flex-col items-center">
                                                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap">
                                                    {pt.score}%
                                                </span>
                                                <div
                                                    className={`w-full rounded-t-sm transition-all ${pt.score >= 70 ? 'bg-green-500' :
                                                        pt.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ height: `${Math.max(6, (pt.score / maxScore) * 112)}px` }}
                                                />
                                            </div>
                                            <DeltaIcon delta={pt.performanceDelta} />
                                            <span className="text-[9px] text-muted-foreground">
                                                {new Date(pt.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Difficulty Accuracy Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Accuracy by Difficulty
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {Object.keys(data.difficultyAccuracy).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No difficulty data recorded yet.</p>
                            ) : (
                                Object.entries(data.difficultyAccuracy).map(([diff, entry]) => (
                                    <div key={diff} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className={`font-medium ${DIFF_TEXT[diff] ?? 'text-foreground'}`}>{diff}</span>
                                            <span className="text-muted-foreground">
                                                {entry.avgScore}% avg · {entry.sessions} session{entry.sessions !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-2 rounded-full transition-all ${DIFF_COLOR[diff] ?? 'bg-primary'}`}
                                                style={{ width: `${entry.avgScore}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Weakest Recurring Topic */}
                    <Card className={data.weakestRecurringTopic ? 'border-red-500/30 bg-red-500/5' : ''}>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Weakest Recurring Topic
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!data.weakestRecurringTopic ? (
                                <p className="text-sm text-muted-foreground">No recurring weak topic detected.</p>
                            ) : (
                                <div className="space-y-2">
                                    <p className="font-bold text-lg text-red-500">{data.weakestRecurringTopic.topic}</p>
                                    <p className="text-sm text-muted-foreground">{data.weakestRecurringTopic.subject}</p>
                                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                        <span>Avg: <strong className="text-red-500">{data.weakestRecurringTopic.avgScore}%</strong></span>
                                        <span>Seen <strong>{data.weakestRecurringTopic.occurrences}×</strong></span>
                                    </div>
                                    <div className="mt-3 p-2 rounded bg-red-500/10 text-xs text-red-600">
                                        💡 Dedicate daily sessions to this topic before the next mock.
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Percentile History */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Percentile vs Own History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.percentileHistory.length < 2 ? (
                                <p className="text-sm text-muted-foreground">Need ≥ 2 sessions for percentile tracking.</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.percentileHistory.slice(-5).reverse().map((p, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span>{p.score}%</span>
                                            <span className={`font-bold ${p.percentile !== null && p.percentile >= 70 ? 'text-green-500' :
                                                p.percentile !== null && p.percentile >= 40 ? 'text-yellow-500' : 'text-muted-foreground'
                                                }`}>
                                                {p.percentile !== null ? `P${p.percentile}` : '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CTA */}
                    <Link to="/mock" className="block">
                        <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                            Start New Mock
                        </button>
                    </Link>
                </div>
            </div>
        </PageContainer>
    );
};

export default MockPerformanceReport;
