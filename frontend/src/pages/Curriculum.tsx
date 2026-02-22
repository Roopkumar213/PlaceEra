import React, { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { CheckCircle, Lock, PlayCircle, Loader2, Target } from 'lucide-react';
import axios from 'axios';

interface Topic {
    name: string;
    mastery: number;
    unlocked: boolean;
    recommended: boolean;
    status: 'MASTERED' | 'IN_PROGRESS' | 'AVAILABLE' | 'LOCKED';
}

interface Module {
    module: string;
    topics: Topic[];
}

const Curriculum: React.FC = () => {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCurriculum = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/curriculum`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setModules(res.data);
            } catch (err) {
                console.error("Failed to fetch curriculum", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCurriculum();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <PageContainer>
            <h1 className="text-3xl font-bold mb-6">Curriculum Roadmap</h1>
            <div className="grid gap-6">
                {modules.map((mod, idx) => (
                    <Card key={idx}>
                        <CardHeader>
                            <CardTitle>{mod.module}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {mod.topics.map((topic, tIdx) => (
                                    <div key={tIdx} className={`flex items-center justify-between p-3 rounded-lg border bg-card/50 ${topic.recommended ? 'border-primary/40 shadow-sm' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            {topic.status === 'MASTERED' ? (
                                                <CheckCircle className="text-green-500" size={20} />
                                            ) : topic.status === 'IN_PROGRESS' ? (
                                                <PlayCircle className="text-blue-500" size={20} />
                                            ) : topic.status === 'AVAILABLE' ? (
                                                <Target className="text-primary animate-pulse-subtle" size={20} />
                                            ) : (
                                                <Lock className="text-muted-foreground" size={20} />
                                            )}
                                            <div className="flex flex-col">
                                                <span className={topic.status === 'LOCKED' ? 'text-muted-foreground' : 'font-medium'}>
                                                    {topic.name}
                                                </span>
                                                {topic.recommended && (
                                                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Recommended</span>
                                                )}
                                            </div>
                                        </div>
                                        {topic.mastery > 0 && (
                                            <Badge variant={topic.mastery >= 70 ? "default" : "secondary"}>
                                                {Math.round(topic.mastery)}%
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </PageContainer>
    );
};

export default Curriculum;
