const { z } = require('zod');

// Auth Schemas
const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100)
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
});

// Onboarding Schema
const onboardingSchema = z.object({
    timezone: z.string().min(1, 'Timezone is required'),
    preferredTimes: z.array(
        z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:mm')
    ).min(1, 'At least one preferred time required').max(2, 'Maximum 2 preferred times allowed'),
    onceOrTwice: z.enum(['once', 'twice'], {
        errorMap: () => ({ message: 'Must be either "once" or "twice"' })
    }),
    emailEnabled: z.boolean().optional().default(true),
    pushEnabled: z.boolean().optional().default(true)
});

// Quiz Submission Schema
const quizSubmissionSchema = z.object({
    quizId: z.string().min(1, 'Quiz ID is required'),
    score: z.number().int().min(0, 'Score must be non-negative'),
    answers: z.array(z.any()).optional(),
    submissionId: z.string().optional()
});

// Forgot Password Schema
const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address')
});

// Reset Password Schema
const resetPasswordSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters').max(100)
});

module.exports = {
    registerSchema,
    loginSchema,
    onboardingSchema,
    quizSubmissionSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};
