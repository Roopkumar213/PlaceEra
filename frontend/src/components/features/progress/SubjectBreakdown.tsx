import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface SubjectDetail {
    mastery: number;
    weight: number;
    // trend?: 'improving' | 'stable' | 'declining'; // Assuming we might get this later
}

interface SubjectBreakdownProps {
    details: Record<string, SubjectDetail>;
    loading?: boolean;
}

export const SubjectBreakdown: React.FC<SubjectBreakdownProps> = ({ details, loading }) => {
    if (loading) return <div>Loading...</div>;

    const subjects = Object.entries(details).sort(([, a], [, b]) => b.weight - a.weight);

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {subjects.map(([subject, data]) => (
                <Card key={subject} className="bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                            {subject}
                            {/* Mock Trend for now based on mastery - later use real data */}
                            {data.mastery > 70 ? (
                                <ArrowUp size={16} className="text-green-500" />
                            ) : data.mastery > 40 ? (
                                <ArrowRight size={16} className="text-yellow-500" />
                            ) : (
                                <ArrowDown size={16} className="text-red-500" />
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-2xl font-bold">{data.mastery}%</span>
                            <span className="text-xs text-muted-foreground">w: {data.weight}</span>
                        </div>
                        <Progress value={data.mastery} className="h-2" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
