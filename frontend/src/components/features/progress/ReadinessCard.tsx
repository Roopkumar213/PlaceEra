import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface ReadinessCardProps {
    score: number;
    classification: string;
    loading?: boolean;
}

const getBadgeColor = (classification: string) => {
    switch (classification) {
        case 'Ready': return 'bg-green-500 hover:bg-green-600';
        case 'Improving': return 'bg-yellow-500 hover:bg-yellow-600';
        case 'Developing': return 'bg-orange-500 hover:bg-orange-600';
        default: return 'bg-red-500 hover:bg-red-600';
    }
};

export const ReadinessCard: React.FC<ReadinessCardProps> = ({ score, classification, loading }) => {
    if (loading) {
        return (
            <Card className="h-full animate-pulse">
                <CardHeader><div className="h-6 w-32 bg-muted rounded"></div></CardHeader>
                <CardContent><div className="h-16 w-16 bg-muted rounded-full"></div></CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full border-l-4 border-l-primary/50 relative overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Placement Readiness</CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info size={16} className="text-muted-foreground hover:text-primary transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Weighted score based on Data Structures (40%), Backend (25%), Core CS (20%), and Aptitude (15%).</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-4">
                    <span className="text-6xl font-bold tracking-tighter">{score}%</span>
                    <Badge className={`mb-2 text-base px-3 py-1 ${getBadgeColor(classification)} text-white border-0`}>
                        {classification}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    Calculated from subject mastery and trend velocity.
                </p>
            </CardContent>
        </Card>
    );
};
