import React, { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, Zap, Target, BookOpen, Activity } from 'lucide-react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface DashboardData {
    readinessScore: number;
    classification: string;
    weeklyTrend: { weekStartDate: string; readinessScore: number }[];
    subjectBreakdown: { subject: string; mastery: number, weight: number }[];
    streak: number;
    quizzesThisWeek: number;
    improvementTrend: string;
    weakestSubject: string;
    strongestSubject: string;
}

const Dashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [stateData, setStateData] = useState<any>(null); // Adaptive State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                // Parallel Fetch
                const [dashboardRes, stateRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`, { headers }),
                    axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/progress/state`, { headers })
                ]);

                setData(dashboardRes.data);
                setStateData(stateRes.data);
            } catch (err) {
                console.error("Dashboard Fetch Error", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Helper for Trend Icon
    const getTrendIcon = (trend: string) => {
        if (trend.includes('Improvement') || trend === 'Improving') return <TrendingUp className="text-green-500" />;
        if (trend.includes('Decline') || trend === 'Needs Attention') return <TrendingDown className="text-red-500" />;
        return <Minus className="text-gray-500" />;
    };

    // Chart Configuration
    const chartData = {
        labels: data?.weeklyTrend.map(w => new Date(w.weekStartDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) || [],
        datasets: [
            {
                label: 'Readiness Score',
                data: data?.weeklyTrend.map(w => w.readinessScore) || [],
                borderColor: 'rgb(99, 102, 241)', // Indigo
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                tension: 0.3
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            y: { min: 0, max: 100 }
        }
    };

    if (loading) return (
        <PageContainer>
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </PageContainer>
    );

    if (error) return (
        <PageContainer>
            <div className="text-destructive text-center mt-10">{error}</div>
        </PageContainer>
    );

    return (
        <PageContainer>
            <div className="flex flex-col gap-6 pb-8 pt-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Global Readiness</h1>
                    <p className="text-muted-foreground">
                        Your real-time placement probability and mastery index.
                    </p>
                </div>

                {/* Adaptive State Banner */}
                {stateData && (
                    <div className={`p-4 rounded-lg border flex flex-col md:flex-row justify-between items-center gap-4 ${stateData.learningState.includes('Improving') ? 'bg-green-500/10 border-green-500/20' :
                        stateData.learningState.includes('Plateau') ? 'bg-yellow-500/10 border-yellow-500/20' :
                            stateData.learningState.includes('Declining') ? 'bg-red-500/10 border-red-500/20' :
                                'bg-blue-500/10 border-blue-500/20'
                        }`}>
                        <div className="flex items-center gap-3">
                            <Activity className={`w-6 h-6 ${stateData.learningState.includes('Improving') ? 'text-green-500' :
                                stateData.learningState.includes('Plateau') ? 'text-yellow-500' :
                                    'text-foreground'
                                }`} />
                            <div>
                                <h3 className="font-semibold text-lg">Adaptive State: {stateData.learningState}</h3>
                                <p className="text-sm text-muted-foreground">Velocity: {stateData.velocity > 0 ? '+' : ''}{stateData.velocity}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium bg-background/50 px-3 py-1 rounded-md">
                            <span className="text-muted-foreground">Recommendation:</span>
                            {stateData.recommendedAction}
                        </div>
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Global Readiness Dashboard</h1>
                        <p className="text-muted-foreground">Real-time placement prediction engine.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="px-3 py-1">
                            {data?.improvementTrend} {getTrendIcon(data?.improvementTrend || 'Stable')}
                        </Badge>
                    </div>
                </div>

                {/* Main Widgets */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                    {/* 1. Readiness Circular Indicator */}
                    <Card className="lg:col-span-1 flex flex-col justify-center items-center py-6 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="uppercase text-xs font-bold text-muted-foreground tracking-widest">Global Score</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            {/* Simple CSS Circle or SVG */}
                            <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-8 border-background shadow-xl bg-background">
                                <div className="absolute inset-0 rounded-full border-8 border-primary opacity-20"></div>
                                {/* Progress Arc Hack: In real app use SVG stroke-dasharray */}
                                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary"
                                        strokeDasharray={`${(data?.readinessScore || 0) * 2.89}, 289`} strokeLinecap="round" />
                                </svg>
                                <div className="text-center z-10">
                                    <span className="text-4xl font-extrabold tracking-tighter">{data?.readinessScore}</span>
                                    <span className="text-sm font-medium text-muted-foreground block">%</span>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <div className="text-lg font-bold text-primary">{data?.classification}</div>
                                <div className="text-xs text-muted-foreground">Based on {data?.subjectBreakdown.length} domains</div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Weekly Trend Chart */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Activity size={16} /> 8-Week Performance Trajectory
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full">
                                <Line data={chartData} options={chartOptions} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                            <Zap className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data?.streak} Days</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Quizzes This Week</CardTitle>
                            <BookOpen className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data?.quizzesThisWeek}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Weakest Link</CardTitle>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold truncate">{data?.weakestSubject || 'N/A'}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Strongest Domain</CardTitle>
                            <Target className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold truncate">{data?.strongestSubject || 'N/A'}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Subject Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle>Subject Mastery Weighting</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data?.subjectBreakdown.map((sub, idx) => (
                                <div key={idx} className="flex items-center gap-4">
                                    <div className="w-32 text-sm font-medium">{sub.subject}</div>
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-500"
                                            style={{ width: `${sub.mastery}%` }}
                                        />
                                    </div>
                                    <div className="w-12 text-sm font-mono text-right">{Math.round(sub.mastery)}%</div>
                                    <div className="text-xs text-muted-foreground w-12 text-right">x{sub.weight}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </PageContainer>
    );
};

export default Dashboard;
