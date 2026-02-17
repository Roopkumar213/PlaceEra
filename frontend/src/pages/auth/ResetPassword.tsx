
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { AntigravityInput } from '../../components/auth/AntigravityInput';
import { InteractiveButton } from '../../components/auth/InteractiveButton';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';

const ResetPassword: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passcodes do not match');
            return;
        }

        setIsLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/reset-password/${token}`, { password });
            setIsSubmitted(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to satisfy reset protocol.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <AuthLayout
                title="Identity Restored"
                subtitle="Your credentials have been successfully updated."
            >
                <div className="bg-success/10 border border-success/20 rounded-xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto text-success shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                        <CheckCircle size={32} />
                    </div>
                    <p className="text-gray-300">
                        Redirecting to secure login via quantum tunnel...
                    </p>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Reset Credentials"
            subtitle="Establish a new secure access key."
        >
            {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <AntigravityInput
                    label="New Password"
                    type="password"
                    placeholder="In.put new secure key"
                    icon={Lock}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <AntigravityInput
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter secure key"
                    icon={Lock}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />

                <InteractiveButton type="submit" isLoading={isLoading}>
                    Update Credentials
                </InteractiveButton>
            </form>

            <div className="text-center mt-6">
                <Link to="/login" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft size={14} /> Cancel Protocol
                </Link>
            </div>
        </AuthLayout>
    );
};

export default ResetPassword;
