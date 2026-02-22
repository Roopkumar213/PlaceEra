import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface MockQuestion {
    id: string;
    questionText: string;
    options: string[];
    topic: string;
    subject: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface SubjectTimeSuggestion { minutes: number; difficultyBias: string }

interface MockSessionConfig {
    totalQuestions: number;
    timeLimitMinutes: number;
    difficultyProfile: string;
    subjectTimeSuggestions: Record<string, SubjectTimeSuggestion>;
}

interface MockStartResponse {
    sessionId: string;
    questions: MockQuestion[];
    startedAt: string;
    config: MockSessionConfig;
}

interface DiffBreakdownEntry { correct: number; total: number; score: number }

interface MockSubmitSummary {
    totalScore: number;
    correct: number;
    total: number;
    performanceDelta: number;
    timeSpentMinutes: number;
    percentile: number | null;
    subjectBreakdown: Record<string, { correct: number; total: number; score: number }>;
    difficultyBreakdown: Record<string, DiffBreakdownEntry>;
    weakestTopic: { topic: string; subject: string; score: number } | null;
    adaptiveConfig?: { difficultyProfile: string; timeLimitMinutes: number };
}

type MockPhase = 'idle' | 'loading' | 'in_progress' | 'submitting' | 'results' | 'error';

const DIFF_BADGE: Record<string, string> = {
    Easy: 'bg-green-500/20 text-green-600',
    Medium: 'bg-yellow-500/20 text-yellow-600',
    Hard: 'bg-red-500/20 text-red-500'
};

const PROFILE_LABEL: Record<string, string> = {
    EASY_HEAVY: '📗 Foundation Focus',
    MIXED: '📘 Balanced',
    HARD_HEAVY: '📕 Challenge Mode'
};

const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

export const MockTestEngine: React.FC = () => {
    const [phase, setPhase] = useState<MockPhase>('idle');
    const [session, setSession] = useState<MockStartResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [summary, setSummary] = useState<MockSubmitSummary | null>(null);
    const [error, setError] = useState('');
    const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

    // Countdown Timer
    useEffect(() => {
        if (phase !== 'in_progress' || timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) { clearInterval(interval); handleSubmit(); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, timeLeft]);

    // Rate-limit cooldown ticker
    useEffect(() => {
        if (rateLimitCooldown <= 0) return;
        const t = setInterval(() => setRateLimitCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [rateLimitCooldown]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const startMock = async () => {
        setPhase('loading');
        setError('');
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/api/mock/start`,
                {},
                authHeaders()
            );
            setSession(res.data);
            setAnswers({});
            setCurrentIndex(0);
            setTimeLeft(res.data.config.timeLimitMinutes * 60);
            setPhase('in_progress');
        } catch (err: any) {
            if (err.response?.status === 429) {
                setRateLimitCooldown(900);
                setError('Rate limited. Please wait before starting another mock test.');
            } else if (err.response?.status === 400) {
                setError(err.response.data.message || 'Cannot start mock: complete more quizzes first.');
            } else {
                setError('Failed to start mock test. Please try again.');
            }
            setPhase('error');
        }
    };

    const handleAnswer = (questionId: string, answer: string) =>
        setAnswers(prev => ({ ...prev, [questionId]: answer }));

    const handleSubmit = useCallback(async () => {
        if (!session) return;
        setPhase('submitting');
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/api/mock/submit`,
                { sessionId: session.sessionId, answers },
                authHeaders()
            );
            setSummary(res.data.summary);
            setPhase('results');
        } catch (err: any) {
            if (err.response?.status === 429) {
                setRateLimitCooldown(900);
                setError('Too many submit attempts. Please wait 15 minutes.');
            } else if (err.response?.status === 404) {
                setError('Session expired or already submitted.');
            } else if (err.response?.status === 400 && err.response?.data?.message?.includes('Tampered')) {
                setError('Submission rejected: answer integrity check failed.');
            } else {
                setError('Submission failed. Your progress is saved — please retry.');
            }
            setPhase('error');
        }
    }, [session, answers]);

    const reset = () => { setPhase('idle'); setSession(null); setAnswers({}); setSummary(null); setError(''); };

    // ── IDLE / ERROR ───────────────────────────────────────────────────────────
    if (phase === 'idle' || phase === 'error') {
        return (
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-1">Adaptive Mock Test · V2</h2>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        30 questions · Difficulty scales with your readiness · Time-pressure adjusted per subject
                    </p>
                </div>

                {error && (
                    <div className="w-full bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {rateLimitCooldown > 0 && (
                    <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-600">
                        ⏱ Cool down: {formatTime(rateLimitCooldown)} before next attempt
                    </div>
                )}

                <div className="flex gap-3 flex-wrap justify-center">
                    <button
                        onClick={startMock}
                        disabled={rateLimitCooldown > 0}
                        className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Begin Mock Test
                    </button>
                    <Link to="/mock/report">
                        <button className="px-6 py-3 rounded-lg border border-border text-sm hover:bg-muted/50 transition">
                            📊 View Full Report
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    // ── LOADING ────────────────────────────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Generating your adaptive mock test…</p>
            </div>
        );
    }

    // ── IN PROGRESS ────────────────────────────────────────────────────────────
    if (phase === 'in_progress' && session) {
        const q = session.questions[currentIndex];
        const progress = ((currentIndex + 1) / session.questions.length) * 100;
        const answered = answers[q.id];
        const isLast = currentIndex === session.questions.length - 1;
        const timePct = session.config.timeLimitMinutes > 0
            ? (timeLeft / (session.config.timeLimitMinutes * 60)) * 100 : 0;

        // Time hint for current subject
        const subjectHint = session.config.subjectTimeSuggestions?.[q.subject];

        return (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">
                            Q{currentIndex + 1}/{session.questions.length}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{q.subject}</span>
                        {q.difficulty && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_BADGE[q.difficulty] ?? ''}`}>
                                {q.difficulty}
                            </span>
                        )}
                        {session.config.difficultyProfile && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                {PROFILE_LABEL[session.config.difficultyProfile] ?? session.config.difficultyProfile}
                            </span>
                        )}
                    </div>
                    <div className={`font-mono text-sm font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-foreground'}`}>
                        ⏱ {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Dual progress: question + time */}
                <div className="h-1.5 bg-muted flex">
                    <div className="h-1.5 bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="h-0.5 bg-muted">
                    <div
                        className={`h-0.5 transition-all duration-1000 ${timePct < 20 ? 'bg-red-500' : timePct < 40 ? 'bg-yellow-500' : 'bg-green-500/50'}`}
                        style={{ width: `${timePct}%` }}
                    />
                </div>

                <div className="p-6 space-y-6">
                    {/* Adaptive time hint */}
                    {subjectHint && (
                        <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-1.5 flex items-center gap-2">
                            <span>💡</span>
                            <span>
                                Suggested time for <strong>{q.subject}</strong>: <strong>{subjectHint.minutes}m</strong>
                                {' '}· Bias: <strong>{subjectHint.difficultyBias.replace('_', ' ')}</strong>
                            </span>
                        </div>
                    )}

                    <p className="text-base font-medium leading-relaxed">{q.questionText}</p>

                    <div className="space-y-2">
                        {q.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(q.id, opt)}
                                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all
                                    ${answered === opt
                                        ? 'border-primary bg-primary/10 text-primary font-medium'
                                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                    }`}
                            >
                                <span className="mr-3 text-muted-foreground font-mono">{String.fromCharCode(65 + idx)}.</span>
                                {opt}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <button
                            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                            disabled={currentIndex === 0}
                            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                        >
                            ← Prev
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {Object.keys(answers).length}/{session.questions.length} answered
                        </span>
                        {isLast ? (
                            <button
                                onClick={handleSubmit}
                                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
                            >
                                Submit Test →
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentIndex(i => Math.min(session.questions.length - 1, i + 1))}
                                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
                            >
                                Next →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── SUBMITTING ─────────────────────────────────────────────────────────────
    if (phase === 'submitting') {
        return (
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Calculating your results…</p>
            </div>
        );
    }

    // ── RESULTS ────────────────────────────────────────────────────────────────
    if (phase === 'results' && summary) {
        const delta = summary.performanceDelta;
        const deltaColor = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';
        const deltaSign = delta > 0 ? '+' : '';

        return (
            <div className="rounded-xl border border-border bg-card p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className={`text-5xl font-bold ${summary.totalScore >= 70 ? 'text-green-500' : summary.totalScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {summary.totalScore}%
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {summary.correct} / {summary.total} correct · {summary.timeSpentMinutes}m
                    </p>
                    <p className={`text-sm font-semibold ${deltaColor}`}>
                        Mastery Δ: {deltaSign}{delta.toFixed(2)} pts
                    </p>
                    {summary.percentile !== null && (
                        <p className="text-xs text-muted-foreground">
                            Percentile (vs own history): <strong className="text-foreground">P{summary.percentile}</strong>
                        </p>
                    )}
                    {summary.adaptiveConfig && (
                        <p className="text-xs text-muted-foreground">
                            Profile: <strong>{PROFILE_LABEL[summary.adaptiveConfig.difficultyProfile] ?? summary.adaptiveConfig.difficultyProfile}</strong>
                        </p>
                    )}
                </div>

                {/* Subject Breakdown */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Subject Breakdown</h3>
                    {Object.entries(summary.subjectBreakdown).map(([sub, data]) => (
                        <div key={sub} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>{sub}</span>
                                <span className="font-mono text-muted-foreground">{data.correct}/{data.total} ({Math.round(data.score)}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all ${data.score >= 70 ? 'bg-green-500' : data.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${data.score}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Difficulty Breakdown */}
                {summary.difficultyBreakdown && Object.keys(summary.difficultyBreakdown).length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">By Difficulty</h3>
                        {(['Easy', 'Medium', 'Hard'] as const).map(diff => {
                            const d = summary.difficultyBreakdown[diff];
                            if (!d) return null;
                            const pct = Math.round(d.score);
                            const barColor = diff === 'Easy' ? 'bg-green-500' : diff === 'Medium' ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                                <div key={diff} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className={DIFF_BADGE[diff] ? '' : ''}>{diff}</span>
                                        <span className="text-muted-foreground font-mono">{d.correct}/{d.total} ({pct}%)</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Weakest Topic */}
                {summary.weakestTopic && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm">
                        <p className="font-semibold text-red-500 mb-0.5">⚠ Weakest Topic This Session</p>
                        <p>{summary.weakestTopic.topic} · {Math.round(summary.weakestTopic.score)}% accuracy</p>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button onClick={reset} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition">
                        Done
                    </button>
                    <Link to="/mock/report" className="flex-1">
                        <button className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition">
                            📊 Full Report
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    return null;
};
