import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CheckCircle, XCircle, Unlock, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import axios from 'axios';
import { addToSyncQueue } from '../../../lib/db';

interface Question {
    text: string;
    options: string[];
    correctAnswer: number; // Index
}

interface QuizPanelProps {
    quizId: string;
    questions: Question[];
    onComplete: (score: number) => void;
}

interface MasteryUpdate {
    current: number;
    previous: number;
    change: number;
    newTrend?: string;
}

interface QuizResult {
    masteryUpdate?: MasteryUpdate;
    unlockedTopics?: string[];
    rateLimited?: boolean;
    error?: string;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({ quizId, questions, onComplete }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});

    const handleOptionSelect = (index: number) => {
        if (isSubmitted) return;
        setSelectedOption(index);
    };

    const handleSubmit = async () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);

        const question = questions[currentQuestion];
        const isCorrect = selectedOption === question.correctAnswer;
        const newAnswers = { ...answers, [currentQuestion]: question.options[selectedOption] };
        setAnswers(newAnswers);

        if (isCorrect) {
            setScore(prev => prev + 1);
        }

        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedOption(null);
                setIsSubmitted(false);
            } else {
                finishQuiz(score + (isCorrect ? 1 : 0), newAnswers);
            }
        }, 1500);
    };

    const finishQuiz = async (finalScore: number, finalAnswers: Record<number, string>) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("No token");

            // Build answers map keyed by question index (as expected by server)
            const answersPayload: Record<string, string> = {};
            Object.entries(finalAnswers).forEach(([idx, opt]) => {
                answersPayload[idx] = opt;
            });

            const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/quiz/submit`, {
                quizId,
                answers: answersPayload
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setResult({
                masteryUpdate: res.data.masteryUpdate,
                unlockedTopics: res.data.unlockedTopics || []
            });
            setShowResults(true);
            onComplete(finalScore);
        } catch (error: any) {
            if (error.response?.status === 429) {
                // Rate limited — start cooldown
                setResult({ rateLimited: true });
            } else {
                console.error("Failed to submit quiz (network). Queuing for sync.", error);
                await addToSyncQueue(
                    `${import.meta.env.VITE_API_BASE_URL}/api/quiz/submit`,
                    'POST',
                    { quizId, answers }
                );
                setResult({ error: 'Submission queued for sync when online.' });
            }
            setShowResults(true);
            onComplete(finalScore);
        }
    };

    if (showResults) {
        const pct = Math.round((score / questions.length) * 100);
        const masteryChange = result?.masteryUpdate?.change ?? 0;
        const unlockedTopics = result?.unlockedTopics ?? [];

        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-muted" />
                        <div
                            className={`absolute inset-0 rounded-full border-4 border-t-transparent ${pct >= 70 ? 'border-green-500' : pct >= 50 ? 'border-yellow-500' : 'border-red-500'}`}
                            style={{ transform: `rotate(${(score / questions.length) * 360}deg)`, transition: 'transform 1s' }}
                        />
                        <div className="text-3xl font-bold">{pct}%</div>
                    </div>
                    <p className="text-muted-foreground">
                        You scored {score} out of {questions.length}
                    </p>

                    {/* Mastery Update */}
                    {result?.masteryUpdate && (
                        <div className="w-full rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm space-y-1">
                            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Mastery Update</p>
                            <div className="flex justify-between">
                                <span>New Mastery</span>
                                <span className="font-bold">{Math.round(result.masteryUpdate.current)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Change</span>
                                <span className={`font-bold ${masteryChange > 0 ? 'text-green-500' : masteryChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {masteryChange > 0 ? '+' : ''}{masteryChange.toFixed(1)} pts
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Unlock Event Feedback */}
                    {unlockedTopics.length > 0 && (
                        <div className="w-full rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 animate-pulse">
                            <div className="flex items-center gap-2 mb-2">
                                <Unlock size={16} className="text-green-500" />
                                <span className="text-sm font-semibold text-green-600">
                                    🎉 New Topic{unlockedTopics.length > 1 ? 's' : ''} Unlocked!
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {unlockedTopics.map((topic) => (
                                    <span key={topic} className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 font-medium">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Rate Limit Warning */}
                    {result?.rateLimited && (
                        <div className="w-full rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 flex items-center gap-2">
                            <Clock size={16} className="text-yellow-500" />
                            <p className="text-sm text-yellow-600">
                                Too many submissions. Score saved locally — please wait before submitting again.
                            </p>
                        </div>
                    )}

                    {/* Sync error */}
                    {result?.error && (
                        <div className="w-full rounded-lg bg-muted/50 border border-border px-4 py-3 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{result.error}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                        Practice Again
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    const question = questions[currentQuestion];

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">Question {currentQuestion + 1} of {questions.length}</CardTitle>
                <Badge variant="outline">{score} Correct</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-lg font-medium">{question.text}</p>
                <div className="grid gap-2">
                    {question.options.map((option, index) => {
                        let variant = "outline";
                        if (isSubmitted) {
                            if (index === question.correctAnswer) variant = "default";
                            else if (index === selectedOption) variant = "destructive";
                        } else if (selectedOption === index) {
                            variant = "secondary";
                        }

                        return (
                            <Button
                                key={index}
                                variant={variant as any}
                                className={cn(
                                    "justify-start h-auto py-3 px-4 text-left whitespace-normal",
                                    isSubmitted && index === question.correctAnswer && "bg-green-600 hover:bg-green-700 border-green-600 text-white",
                                    isSubmitted && index === selectedOption && index !== question.correctAnswer && "bg-red-600 hover:bg-red-700 border-red-600 text-white"
                                )}
                                onClick={() => handleOptionSelect(index)}
                                disabled={isSubmitted}
                            >
                                <div className="flex items-center w-full">
                                    <span className="flex-1">{option}</span>
                                    {isSubmitted && index === question.correctAnswer && <CheckCircle size={16} className="ml-2" />}
                                    {isSubmitted && index === selectedOption && index !== question.correctAnswer && <XCircle size={16} className="ml-2" />}
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </CardContent>
            <CardFooter className="justify-end">
                <Button onClick={handleSubmit} disabled={selectedOption === null || isSubmitted}>
                    {isSubmitted ? "Processing..." : (currentQuestion < questions.length - 1 ? "Next Question" : "Finish Quiz")}
                </Button>
            </CardFooter>
        </Card>
    );
};
