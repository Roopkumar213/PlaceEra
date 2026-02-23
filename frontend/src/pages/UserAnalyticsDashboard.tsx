import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
    BarChart2, TrendingUp, Trophy, Target,
    AlertTriangle, Download, RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
};

interface SubjectBd { subject: string; mastery: number; totalTopics: number; masteredTopics: number; totalAttempts: number }
interface VelPoint { date: string; avgDelta: number; sessions: number }
interface TopTopic { topic: string; subject: string; mastery: number }
interface Analytics {
    totalQuizzes: number;
    totalMocks: number;
    avgImprovementRate: number;
    strongestSubject: { subject: string; mastery: number } | null;
    weakestSubject: { subject: string; mastery: number } | null;
    subjectBreakdown: SubjectBd[];
    recentVelocity: VelPoint[];
    topTopics: TopTopic[];
}

const MASTRY_COLOR = (m: number) =>
    m >= 70 ? 'bg-green-500' : m >= 50 ? 'bg-yellow-500' : 'bg-red-500';

const MASTRY_TEXT = (m: number) =>
    m >= 70 ? 'text-green-500' : m >= 50 ? 'text-yellow-500' : 'text-red-500';

async function triggerDownload(url: string, filename: string) {
    const token = localStorage.getItem('token');
    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
    });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
}

async function triggerRebuild(setStatus: (s: string) => void) {
    const token = localStorage.getItem('token');
    setStatus('Rebuilding…');
    try {
        const res = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/api/system/rebuild`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setStatus(`✅ Rebuild complete — ${res.data.rebuiltSubjects?.length ?? 0} subjects rebuilt`);
    } catch {
        setStatus('❌ Rebuild failed. Try again later.');
    }
    setTimeout(() => setStatus(''), 5000);
}

const UserAnalyticsDashboard: React.FC = () => {
    const { data, isLoading, error } = useSWR<Analytics>(
        `${import.meta.env.VITE_API_BASE_URL}/api/user/analytics`,
        fetcher,
        { dedupingInterval: 30000, revalidateOnFocus: false }
    );

    const [rebuildStatus, setRebuildStatus] = React.useState('');

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
                <Loader2 size={24} className="animate-spin" />
                <span>Loading analytics…</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertTriangle size={36} className="text-destructive" />
                <p className="text-muted-foreground">Could not load your analytics.</p>
            </div>
        );
    }

    const base = import.meta.env.VITE_API_BASE_URL;
    const maxV = Math.max(...data.recentVelocity.map(v => v.avgDelta), 1);

    return (
        <div className="min-h-screen bg-background text-foreground px-4 py-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">My Analytics</h1>
                    <p className="text-sm text-muted-foreground">Your complete learning performance overview</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => triggerDownload(`${base}/api/user/export/csv`, 'mock_history.csv')}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition"
                    >
                        <Download size={14} /> Export CSV
                    </button>
                    <button
                        onClick={() => triggerDownload(`${base}/api/user/export/mastery`, 'mastery_snapshot.json')}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition"
                    >
                        <Download size={14} /> Export Mastery
                    </button>
                    <button
                        onClick={() => triggerRebuild(setRebuildStatus)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition"
                    >
                        <RefreshCw size={14} /> Rebuild Data
                    </button>
                </div>
            </div>

            {rebuildStatus && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-sm text-primary">
                    {rebuildStatus}
                </div>
            )}

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Quizzes', value: data.totalQuizzes, icon: Target, color: 'text-primary' },
                    { label: 'Total Mocks', value: data.totalMocks, icon: BarChart2, color: 'text-blue-500' },
                    { label: 'Avg Improvement', value: `${data.avgImprovementRate} pts`, icon: TrendingUp, color: 'text-green-500' },
                    { label: 'Top Topics Ready', value: data.topTopics.length, icon: Trophy, color: 'text-yellow-500' }
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
                            <Icon size={15} className={color} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Subject Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Subject Mastery Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.subjectBreakdown.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No subject data yet. Complete some quizzes first.</p>
                            ) : (
                                data.subjectBreakdown.map(s => (
                                    <div key={s.subject} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">{s.subject}</span>
                                            <span className="flex items-center gap-3 text-muted-foreground text-xs">
                                                <span>{s.masteredTopics}/{s.totalTopics} mastered</span>
                                                <span className={`font-bold ${MASTRY_TEXT(s.mastery)}`}>{s.mastery}%</span>
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-2.5 rounded-full transition-all ${MASTRY_COLOR(s.mastery)}`}
                                                style={{ width: `${s.mastery}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Velocity Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Learning Velocity — Last 7 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.recentVelocity.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No activity in the last 7 days.</p>
                            ) : (
                                <div className="flex items-end gap-2 h-24">
                                    {data.recentVelocity.map((v, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                            <div className="relative w-full">
                                                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                                    Δ{v.avgDelta}
                                                </span>
                                                <div
                                                    className="w-full rounded-t-sm bg-primary/70"
                                                    style={{ height: `${Math.max(4, (v.avgDelta / maxV) * 80)}px` }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-muted-foreground">
                                                {new Date(v.date).toLocaleDateString('en', { weekday: 'short' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Panel */}
                <div className="space-y-6">
                    {/* Strongest / Weakest */}
                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                🏆 Strongest Subject
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.strongestSubject ? (
                                <div>
                                    <p className="text-lg font-bold text-green-500">{data.strongestSubject.subject}</p>
                                    <p className="text-2xl font-black">{data.strongestSubject.mastery}%</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No data yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-red-500/20 bg-red-500/5">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                ⚠️ Weakest Subject
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.weakestSubject ? (
                                <div>
                                    <p className="text-lg font-bold text-red-500">{data.weakestSubject.subject}</p>
                                    <p className="text-2xl font-black">{data.weakestSubject.mastery}%</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No data yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Topics */}
                    {data.topTopics.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    Top Mastered Topics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {data.topTopics.map((t, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <div>
                                            <p className="font-medium">{t.topic}</p>
                                            <p className="text-xs text-muted-foreground">{t.subject}</p>
                                        </div>
                                        <span className={`text-sm font-bold ${MASTRY_TEXT(t.mastery)}`}>
                                            {t.mastery}%
                                        </span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Links */}
                    <div className="space-y-2">
                        <Link to="/mock/report" className="block w-full text-center py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
                            📊 Mock Performance Report
                        </Link>
                        <Link to="/progress" className="block w-full text-center py-2 px-4 rounded-lg border border-border text-sm hover:bg-muted/50 transition">
                            Progress Overview
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserAnalyticsDashboard;
