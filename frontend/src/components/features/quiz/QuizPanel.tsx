import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import axios from 'axios';
import { addToSyncQueue } from '../../../lib/db';
// import { useAuth } from '../../../context/AuthContext';

interface Question {
    text: string;
    options: string[];
    correctAnswer: number; // Index
}

interface QuizPanelProps {
    quizId: string; // Or part of daily concept
    questions: Question[];
    onComplete: (score: number) => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({ quizId, questions, onComplete }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    // const [isLoading, setIsLoading] = useState(false);
    // const { user } = useAuth(); // If needed for logging

    const handleOptionSelect = (index: number) => {
        if (isSubmitted) return;
        setSelectedOption(index);
    };

    const handleSubmit = async () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);

        const isCorrect = selectedOption === questions[currentQuestion].correctAnswer;
        if (isCorrect) {
            setScore(prev => prev + 1);
        }

        // Just wait a bit for visual feedback
        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedOption(null);
                setIsSubmitted(false);
            } else {
                finishQuiz(score + (isCorrect ? 1 : 0));
            }
        }, 1500);
    };



    const finishQuiz = async (finalScore: number) => {
        // setIsLoading(true); // Optional: show loading state
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("No token");

            // Submit to backend
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/quiz/submit`, {
                quizId,
                answers: [],
                score: finalScore
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setShowResults(true);
            onComplete(finalScore);
        } catch (error) {
            console.error("Failed to submit quiz (network). Queuing for sync.", error);

            // Offline Fallback: Queue it
            await addToSyncQueue(
                `${import.meta.env.VITE_API_BASE_URL}/api/quiz/submit`,
                'POST',
                { quizId, answers: [], score: finalScore }
            );

            // Optimistic success
            setShowResults(true);
            onComplete(finalScore);
        } finally {
            // setIsLoading(false);
        }
    };

    if (showResults) {
        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-muted" />
                        <div
                            className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
                            style={{ animationDuration: '0s', transform: `rotate(${(score / questions.length) * 360}deg)` }}
                        />
                        <div className="text-3xl font-bold">{Math.round((score / questions.length) * 100)}%</div>
                    </div>
                    <p className="text-muted-foreground">
                        You scored {score} out of {questions.length}
                    </p>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                        Close
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
                            if (index === question.correctAnswer) variant = "default"; // Correct (Greenish if default is primary)
                            else if (index === selectedOption) variant = "destructive"; // Wrong
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
