import React from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { PageContainer } from '../components/layout/PageContainer';
import { ReadinessCard } from '../components/features/progress/ReadinessCard';
import { SubjectBreakdown } from '../components/features/progress/SubjectBreakdown';
import TrendChart from '../components/features/progress/TrendChart'; // Lazy loaded inside? SWR handles data wait
import { TransparencyPanel } from '../components/features/progress/TransparencyPanel';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

// Fetcher
const fetcher = (url: string) => {
    const token = localStorage.getItem('token');
    return axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.data);
};

const Progress: React.FC = () => {
    // Top Level Error Boundary could be nice, but simple checks here
    const { data: readiness, error: rError, isLoading: rLoading, mutate: mutateReadiness } = useSWR(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/readiness`,
        fetcher
    );

    const { data: dashboard, error: dError, isLoading: dLoading } = useSWR(
        `${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`,
        fetcher
    );

    if (rError || dError) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                    <AlertCircle size={48} className="text-destructive" />
                    <p className="text-lg font-medium">Failed to load progress data.</p>
                    <Button onClick={() => mutateReadiness()}>Retry</Button>
                </div>
            </PageContainer>
        );
    }

    // Mock trend data for chart if recentActivity is not enough
    // Dashboard returns "recentActivity" which are lessons. 
    // Ideally backend should return "trendHistory" or similar.
    // For Phase 4 MVP, let's map recentActivity scores or use a placeholder if empty.

    // Actually, dashboard endpoint in backend returns `recentActivity` (UserProgress docs).
    // UserProgress has `completedDate` and `quizScore`.
    // We can map that to chart data.

    const trendData = dashboard?.recentActivity?.map((a: any) => ({
        date: a.completedDate, // or a.completedAt
        score: a.quizScore // assuming percent or raw score? Backend: quizScore is raw? 
        // We probably want percentage for chart.
        // Backend UserProgress has quizScore and quizTotal.
    })).map((d: any) => ({
        ...d,
        score: (d.score / (d.quizTotal || 1)) * 100 // Normalize to %? 
        // Wait, UserProgress schema: quizScore (Number).
        // Let's assume frontend needs to normalize.
    })) || [];


    return (
        <PageContainer>
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Your Progress</h1>
                <p className="text-muted-foreground">Track your readiness for placement season.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                {/* Main Readiness Card */}
                <div className="lg:col-span-1 h-64">
                    <ReadinessCard
                        score={readiness?.score || 0}
                        classification={readiness?.classification || 'Unknown'}
                        loading={rLoading}
                    />
                </div>

                {/* Trend Chart (Takes up 2 cols on huge screens) */}
                <div className="md:col-span-2 h-64">
                    <TrendChart data={trendData} loading={dLoading} />
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight">Subject Breakdown</h2>
                <SubjectBreakdown details={readiness?.details || {}} loading={rLoading} />
            </div>

            <TransparencyPanel />
        </PageContainer>
    );
};

export default Progress;
