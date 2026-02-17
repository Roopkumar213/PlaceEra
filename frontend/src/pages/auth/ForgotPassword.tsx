import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { AntigravityInput } from '../../components/auth/AntigravityInput';
import { InteractiveButton } from '../../components/auth/InteractiveButton';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Simulate API call
        // await new Promise(r => setTimeout(r, 1000));

        try {
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/forgot-password`, { email });
            setIsSubmitted(true);
        } catch (err: any) {
            // For security, often we don't say if email failed to prevent enumeration, 
            // but for UX we might want to tell them if serverside failed.
            // Let's assume a generic success or specific error.
            // If mocked:
            setIsSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <AuthLayout
                title="Check your comms"
                subtitle={`We have sent a recovery signal to ${email}`}
            >
                <div className="bg-plasma/10 border border-plasma/20 rounded-xl p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-plasma/20 rounded-full flex items-center justify-center mx-auto text-plasma">
                        <Mail size={24} />
                    </div>
                    <p className="text-sm text-gray-300">
                        If the identity exists in our database, you will receive a secure link to reset your credentials.
                    </p>
                    <InteractiveButton onClick={() => setIsSubmitted(false)} variant="secondary">
                        Resend Signal
                    </InteractiveButton>
                </div>

                <div className="text-center mt-6">
                    <Link to="/login" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft size={14} /> Return to Login
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Recover Identity"
            subtitle="Enter your verified email to re-establish connection."
        >
            {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <AntigravityInput
                    label="Registered Email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <InteractiveButton type="submit" isLoading={isLoading}>
                    Send Recovery Link
                </InteractiveButton>
            </form>

            <div className="text-center mt-6">
                <Link to="/login" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft size={14} /> Back to Login
                </Link>
            </div>
        </AuthLayout>
    );
};

export default ForgotPassword;
