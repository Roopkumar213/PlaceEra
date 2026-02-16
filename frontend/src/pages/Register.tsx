import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { AntigravityInput } from '../components/AntigravityInput';
import { InteractiveButton } from '../components/InteractiveButton';
import { AlertCircle, Sparkles } from 'lucide-react';

const Register: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate delay
        await new Promise(r => setTimeout(r, 800));

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/register`, {
                name,
                email,
                password
            });
            login(response.data.token, response.data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Join the Corps"
            subtitle="Create your identity to begin training."
        >
            {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <AntigravityInput
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <AntigravityInput
                    label="Email Address"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <AntigravityInput
                    label="Password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <div className="flex items-start gap-3 p-3 bg-plasma/10 rounded-lg border border-plasma/20">
                    <Sparkles className="text-plasma shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-gray-300 leading-relaxed">
                        By joining, you get instant access to our AI-powered learning engine and daily challenges.
                    </p>
                </div>

                <InteractiveButton type="submit" isLoading={isLoading}>
                    Create Account
                </InteractiveButton>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account? <Link to="/login" className="text-white hover:text-plasma transition-colors font-medium">Log in</Link>
            </p>
        </AuthLayout>
    );
};

export default Register;
