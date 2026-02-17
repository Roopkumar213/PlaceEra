import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PageContainer } from '../components/layout/PageContainer';
import { Badge } from '../components/ui/badge';
import { ArrowRight, Zap, Target, BookOpen, Trophy, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface DashboardStats {
    streak: number;
    totalLessons: number;
    weakTopics: { topic: string; proficiency: number }[];
    recentActivity: any[];
}

const Home: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/progress/dashboard`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (err) {
                console.error("Failed to fetch dashboard stats", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const isLoading = loading || !stats;

    return (
        <PageContainer>
            {/* Hero Section */}
            <section className="flex flex-col items-start gap-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
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
                <div className="flex gap-4 mt-4">
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

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
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
                                <div className="text-2xl font-bold">{stats.weakTopics.filter(t => t.proficiency > 80).length}</div>
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
