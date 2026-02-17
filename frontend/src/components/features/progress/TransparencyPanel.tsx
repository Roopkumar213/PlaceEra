import React from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../../ui/accordion';
import { Card, CardContent } from '../../ui/card';
import { Brain, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

export const TransparencyPanel: React.FC = () => {
    return (
        <Card className="mt-8 border-dashed shadow-none bg-transparent">
            <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-b-0">
                        <AccordionTrigger className="text-sm text-muted-foreground hover:text-primary justify-start gap-2 hover:no-underline py-0">
                            <Brain size={16} />
                            How This Is Calculated
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 text-muted-foreground text-sm grid gap-4 sm:grid-cols-2">
                            <div className="flex gap-3">
                                <TrendingUp className="text-green-500 shrink-0" size={18} />
                                <div>
                                    <strong className="text-foreground block mb-1">Adaptive Mastery</strong>
                                    Scores {'>'} 80% increase mastery by 25%. Scores {'<'} 40% cause decay.
                                    Repeated high scores on same topic have diminishing returns.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Clock className="text-blue-500 shrink-0" size={18} />
                                <div>
                                    <strong className="text-foreground block mb-1">Forgetting Curve</strong>
                                    Knowledge decays exponentially if not practiced.
                                    Mastery drops ~2% per day of inactivity after a grace period.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <AlertTriangle className="text-orange-500 shrink-0" size={18} />
                                <div>
                                    <strong className="text-foreground block mb-1">Revision Queue</strong>
                                    Failed topics (score {'<'} 60%) are automatically queued for revision tomorrow.
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};
