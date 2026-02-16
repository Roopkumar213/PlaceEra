import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

interface CodeExample {
    language: string;
    code: string;
}

interface DailyConcept {
    _id: string;
    date: string;
    subject: string;
    topic: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    summary: string;
    explanation: string;
    codeExample: CodeExample;
    quiz: QuizQuestion[];
}

const Today: React.FC = () => {
    const [concept, setConcept] = useState<DailyConcept | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);

    useEffect(() => {
        fetchTodayConcept();
    }, []);

    const fetchTodayConcept = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/today`, {
                headers: { 'x-auth-token': token }
            });
            setConcept(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load today\'s lesson');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (questionIndex: number, answer: string) => {
        setSelectedAnswers(prev => ({ ...prev, [questionIndex]: answer }));
    };

    const handleQuizSubmit = () => {
        setQuizSubmitted(true);
    };

    const handleCompleteSession = () => {
        // TODO: Mark session as complete in backend
        alert('Session completed! Great work.');
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Easy': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'Medium': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'Hard': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading today's lesson...</p>
                </div>
            </div>
        );
    }

    if (error || !concept) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center p-6">
                <div className="glass-panel p-8 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Failed to Load</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={fetchTodayConcept}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void text-gray-200">
            {/* Header */}
            <header className="border-b border-white/5 bg-surface/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold font-mono">E</div>
                        <div>
                            <h1 className="font-display font-bold text-lg text-white">Today's Lesson</h1>
                            <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                        </div>
                    </div>
                    <a href="/dashboard" className="text-sm text-gray-400 hover:text-primary transition-colors">← Back to Dashboard</a>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">

                {/* Subject & Topic Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-mono text-primary uppercase tracking-wider">
                            {concept.subject}
                        </span>
                        <span className={`px-3 py-1 border rounded-full text-xs font-mono uppercase tracking-wider ${getDifficultyColor(concept.difficulty)}`}>
                            {concept.difficulty}
                        </span>
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold text-white">{concept.topic}</h1>
                </motion.div>

                {/* Summary Block */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel p-6 md:p-8 border border-white/5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-white">Summary</h2>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{concept.summary}</p>
                </motion.section>

                {/* Explanation Block */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel p-6 md:p-8 border border-white/5"
                >
                    <h2 className="text-xl font-bold text-white mb-4">Detailed Explanation</h2>
                    <div
                        className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: concept.explanation }}
                    />
                </motion.section>

                {/* Code Example Block */}
                {concept.codeExample && concept.codeExample.code && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-panel p-6 md:p-8 border border-white/5"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Code2 className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-bold text-white">Code Example</h2>
                            <span className="ml-auto text-xs font-mono text-gray-500 uppercase">{concept.codeExample.language}</span>
                        </div>
                        <div className="bg-black/60 rounded-lg border border-white/10 p-4 overflow-x-auto">
                            <pre className="text-sm text-gray-300 font-mono">
                                <code>{concept.codeExample.code}</code>
                            </pre>
                        </div>
                    </motion.section>
                )}

                {/* Quiz Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel p-6 md:p-8 border border-white/5"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-white">Knowledge Check</h2>
                    </div>

                    <div className="space-y-6">
                        {concept.quiz.map((question, qIndex) => (
                            <div key={qIndex} className="space-y-3">
                                <p className="font-medium text-white">
                                    <span className="text-primary mr-2">{qIndex + 1}.</span>
                                    {question.question}
                                </p>
                                <div className="space-y-2 ml-6">
                                    {question.options.map((option, oIndex) => {
                                        const isSelected = selectedAnswers[qIndex] === option;
                                        const isCorrect = option === question.correctAnswer;
                                        const showResult = quizSubmitted;

                                        let optionClass = 'p-3 rounded-lg border transition-all cursor-pointer ';
                                        if (showResult) {
                                            if (isCorrect) {
                                                optionClass += 'border-green-500/50 bg-green-500/10 text-green-400';
                                            } else if (isSelected && !isCorrect) {
                                                optionClass += 'border-red-500/50 bg-red-500/10 text-red-400';
                                            } else {
                                                optionClass += 'border-white/5 bg-white/5 text-gray-400';
                                            }
                                        } else {
                                            optionClass += isSelected
                                                ? 'border-primary bg-primary/10 text-white'
                                                : 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/50';
                                        }

                                        return (
                                            <label key={oIndex} className={optionClass}>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name={`question-${qIndex}`}
                                                        value={option}
                                                        checked={isSelected}
                                                        onChange={() => handleAnswerSelect(qIndex, option)}
                                                        disabled={quizSubmitted}
                                                        className="accent-primary"
                                                    />
                                                    <span>{option}</span>
                                                    {showResult && isCorrect && (
                                                        <CheckCircle2 className="w-4 h-4 ml-auto text-green-400" />
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {!quizSubmitted && (
                        <button
                            onClick={handleQuizSubmit}
                            disabled={Object.keys(selectedAnswers).length !== concept.quiz.length}
                            className="mt-6 w-full md:w-auto px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Submit Quiz
                        </button>
                    )}
                </motion.section>

                {/* Complete Session Button */}
                {quizSubmitted && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <button
                            onClick={handleCompleteSession}
                            className="px-12 py-4 bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-lg rounded-full hover:shadow-[0_0_30px_rgba(110,68,255,0.5)] transition-all"
                        >
                            Complete Session
                        </button>
                    </motion.div>
                )}
            </main>
        </div>
    );
};

export default Today;
