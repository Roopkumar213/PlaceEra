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
    track?: string;
    cluster?: string;
    topics: Topic[];
}

const TRACKS = ['DSA', 'APTITUDE', 'DEV', 'DEVOPS'];

const Curriculum: React.FC = () => {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrack, setSelectedTrack] = useState<string>('DSA');

    useEffect(() => {
        const fetchCurriculum = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/curriculum?track=${selectedTrack}`, {
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
    }, [selectedTrack]);

    return (
        <PageContainer>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h1 className="text-3xl font-bold">Curriculum Roadmap</h1>

                {/* Track Selector Tabs */}
                <div className="flex flex-wrap items-center bg-muted/40 p-1 rounded-xl border border-border shrink-0">
                    {TRACKS.map(track => (
                        <button
                            key={track}
                            onClick={() => setSelectedTrack(track)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTrack === track
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            {track}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : modules.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-xl bg-card/50">
                    No curriculum data found for the <strong>{selectedTrack}</strong> track.
                </div>
            ) : (
                <div className="grid gap-6">
                    {modules.map((mod, idx) => (
                        <Card key={idx}>
                            <CardHeader className="pb-3 border-b mb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xl">{mod.module}</CardTitle>
                                    {mod.cluster && (
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {mod.cluster}
                                        </Badge>
                                    )}
                                </div>
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
            )}
        </PageContainer>
    );
};

export default Curriculum;
