import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { AntigravityInput } from '../components/AntigravityInput';
import { InteractiveButton } from '../components/InteractiveButton';
import { AlertCircle, ArrowRight, Github, Chrome } from 'lucide-react';
import axios from 'axios';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Simulate delay for effect
        await new Promise(r => setTimeout(r, 800));

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
                email,
                password
            });
            login(response.data.token, response.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Enter your credentials to access the simulation."
        >
            {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <AntigravityInput
                    label="Email Address"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <div className="space-y-1">
                    <AntigravityInput
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <div className="flex justify-end">
                        <Link to="/forgot-password" className="text-xs text-plasma hover:text-plasmaHover transition-colors">
                            Forgot password?
                        </Link>
                    </div>
                </div>

                <InteractiveButton type="submit" isLoading={isLoading}>
                    Initiate Session <ArrowRight size={16} />
                </InteractiveButton>
            </form>

            <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-void px-2 text-gray-500">Or continue with</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <InteractiveButton variant="secondary" className="justify-center">
                    <Github size={18} /> <span className="ml-2">GitHub</span>
                </InteractiveButton>
                <InteractiveButton variant="secondary" className="justify-center">
                    <Chrome size={18} /> <span className="ml-2">Google</span>
                </InteractiveButton>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
                Don't have access? <Link to="/register" className="text-white hover:text-plasma transition-colors font-medium">Request entry</Link>
            </p>
        </AuthLayout>
    );
};

export default Login;
