import React, { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { QuizPanel } from '../components/features/quiz/QuizPanel';
import { Loader2, AlertCircle, WifiOff } from 'lucide-react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { saveLesson, getLesson } from '../lib/db';

interface DailyLesson {
    _id: string;
    date: string;
    subject: string;
    topic: string;
    concept: string;
    explanation: string;
    codeExample?: string;
    quiz: {
        text: string;
        options: string[];
        correctAnswer: number;
    }[];
}

const Today: React.FC = () => {
    const [lesson, setLesson] = useState<DailyLesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [offline, setOffline] = useState(false);

    const fetchLesson = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/today`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLesson(response.data);

            // Cache locally in IDB
            await saveLesson(response.data);
            setOffline(false);
        } catch (err: any) {
            console.error("Failed to fetch lesson", err);
            // Try load from IDB
            try {
                const cached = await getLesson('latest');
                if (cached) {
                    setLesson(cached);
                    setOffline(true);
                } else {
                    setError('Could not load today\'s lesson. Please check your connection.');
                }
            } catch (dbErr) {
                console.error("DB Error", dbErr);
                setError('Could not access offline storage.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLesson();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                    <AlertCircle size={48} className="text-destructive" />
                    <p className="text-lg font-medium">{error}</p>
                    <Button onClick={fetchLesson}>Retry</Button>
                </div>
            </PageContainer>
        );
    }

    if (!lesson) return null;

    return (
        <PageContainer>
            {offline && (
                <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3 text-yellow-500">
                    <WifiOff size={18} />
                    <p className="text-sm font-medium">You are offline. Viewing cached lesson.</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge>{lesson.subject}</Badge>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">{new Date(lesson.date).toLocaleDateString()}</span>
                            </div>
                            <CardTitle className="text-3xl font-bold text-primary">{lesson.topic}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Concept</h3>
                                <p className="text-muted-foreground leading-relaxed">{lesson.concept}</p>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-2">Explanation</h3>
                                <div className="prose prose-invert max-w-none text-muted-foreground">
                                    {lesson.explanation}
                                </div>
                            </div>

                            {lesson.codeExample && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Code Example</h3>
                                    <pre className="p-4 rounded-lg bg-black/50 border overflow-x-auto text-sm font-mono text-blue-300">
                                        {lesson.codeExample}
                                    </pre>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-start-3">
                    <div className="sticky top-24">
                        <QuizPanel
                            quizId={lesson._id}
                            questions={lesson.quiz || []}
                            onComplete={(score) => console.log('Quiz completed', score)}
                        />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default Today;
