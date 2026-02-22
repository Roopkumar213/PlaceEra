import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PageContainer } from '../components/layout/PageContainer';
import { Badge } from '../components/ui/badge';
import { ArrowRight, Zap, Target, BookOpen, Trophy, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

import { HomeReadinessWidget } from '../components/features/progress/HomeReadinessWidget';

interface DashboardStats {
    streak: number;
    totalLessons: number;
    weakTopics: { topic: string; mastery: number }[];
    recentActivity: any[];
    isFirstSession: boolean;
    firstRecommendedTopic: { topic: string; subject: string; mastery: number } | null;
}

interface Recommendation {
    subjectId: string;
    topicId: string;
    subjectReadiness: number;
    topicMastery: number;
    status: string;
    reason: string;
}

const Home: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const [statsRes, recoRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/recommendation`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => ({ data: null })) // Graceful fail if no recommendation
                ]);

                setStats(statsRes.data);
                setRecommendation(recoRes.data);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const isLoading = loading || !stats;

    return (
        <PageContainer>
            <section className="flex flex-col items-start gap-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-24">
                <Badge variant="secondary" className="mb-2">
                    System v2.1 Online
                </Badge>
                <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
                    Welcome back, <span className="text-primary">{user?.name}</span>.
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
                    Your daily structured placement training is ready.
                    Continue your streak and master the curriculum one concept at a time.
                </p>

                <HomeReadinessWidget />

                <div className="flex gap-4 mt-2">
                    <Link to="/today">
                        <Button size="lg" className="gap-2">
                            <Zap size={18} /> Start Daily Training
                        </Button>
                    </Link>
                    <Link to="/curriculum">
                        <Button size="lg" variant="outline" className="gap-2">
                            View Roadmap <ArrowRight size={18} />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Day 0 Experience: Onboarding Required */}
            {!isLoading && user && !user.onboardingComplete && (
                <Card className="border-yellow-500/50 bg-yellow-500/5 mb-8 overflow-hidden relative">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="text-yellow-600" />
                            Complete Your Setup
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-muted-foreground">
                                    To provide a personalized learning experience, we need to know your preferences and timezone.
                                </p>
                            </div>
                            <Link to="/settings">
                                <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700">
                                    Finish Onboarding
                                    <ArrowRight className="ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Today's Focus: Intelligent Recommendation Card */}
            {!isLoading && user?.onboardingComplete && recommendation && (
                <Card className="border-primary/50 bg-primary/5 mb-8 overflow-hidden relative shadow-lg">
                    <div className="absolute -top-6 -right-6 p-4 opacity-5 rotate-12">
                        <Trophy size={160} />
                    </div>
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <CardTitle className="flex items-center gap-2">
                                <Target className="text-primary" />
                                Today's Focus
                            </CardTitle>
                            <Badge variant="outline" className="border-primary/50 text-primary">
                                {recommendation.reason}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Subject</p>
                                        <p className="font-semibold">{recommendation.subjectId}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Topic</p>
                                        <p className="font-semibold">{recommendation.topicId}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Topic Mastery</p>
                                        <p className="font-semibold text-primary">{Math.round(recommendation.topicMastery)}%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Subject Readiness</p>
                                        <p className="font-semibold text-orange-500">{Math.round(recommendation.subjectReadiness)}%</p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    This topic is prioritized because it belongs to your weakest domain. Improving this will yield the highest lift to your overall readiness.
                                </p>
                            </div>
                            <Link to={`/today?topic=${encodeURIComponent(recommendation.topicId)}`}>
                                <Button size="lg" className="group shadow-md px-8 py-6 h-auto text-lg">
                                    Start Practice
                                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Day 1 Experience: Start Here Card (Only if recommendation not shown or redundant) */}
            {!isLoading && user?.onboardingComplete && stats.isFirstSession && !recommendation && (
                <Card className="border-primary/50 bg-primary/5 mb-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap size={120} />
                    </div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="text-primary" />
                            Start Your Journey
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-muted-foreground">
                                    We've analyzed your onboarding and unlocked the best starting points for you.
                                </p>
                                {stats.firstRecommendedTopic && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-primary border-primary/30">
                                            First Up: {stats.firstRecommendedTopic.topic}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">in {stats.firstRecommendedTopic.subject}</span>
                                    </div>
                                )}
                            </div>
                            <Link to={stats.firstRecommendedTopic ? `/today` : `/curriculum`}>
                                <Button size="lg" className="group">
                                    Begin First Quiz
                                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
                        <Zap className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">{stats.streak} Days</div>
                                <p className="text-xs text-muted-foreground">Keep it up!</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Topics Mastered</CardTitle>
                        <Target className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">{stats.weakTopics.filter(t => t.mastery > 80).length}</div>
                                <p className="text-xs text-muted-foreground">High proficiency topics</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
                        <BookOpen className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">{stats.totalLessons}</div>
                                <p className="text-xs text-muted-foreground">Total sessions</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Weakest Topic</CardTitle>
                        <Trophy className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                                <div className="text-xl font-bold truncate">
                                    {stats.weakTopics[0]?.topic || 'None'}
                                </div>
                                <p className="text-xs text-muted-foreground">Focus on this!</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
};

export default Home;
