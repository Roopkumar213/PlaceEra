import React, { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { CheckCircle, Lock, PlayCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

interface Topic {
    name: string;
    proficiency: number;
    status: 'Mastered' | 'In Progress' | 'Locked';
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
                                    <div key={tIdx} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                                        <div className="flex items-center gap-3">
                                            {topic.status === 'Mastered' ? (
                                                <CheckCircle className="text-green-500" size={20} />
                                            ) : topic.status === 'In Progress' ? (
                                                <PlayCircle className="text-blue-500" size={20} />
                                            ) : (
                                                <Lock className="text-muted-foreground" size={20} />
                                            )}
                                            <span className={topic.status === 'Locked' ? 'text-muted-foreground' : ''}>
                                                {topic.name}
                                            </span>
                                        </div>
                                        {topic.proficiency > 0 && (
                                            <Badge variant="secondary">{topic.proficiency}%</Badge>
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
