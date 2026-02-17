import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import axios from 'axios';
import { setAuthToken, getAuthToken } from '../lib/auth';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = getAuthToken();
            if (token) {
                try {
                    // Verify token and get user (optional, can just trust token for initial load if strict security not needed)
                    // For now, let's assume if token exists we are likely good or will catch 401 later on requests
                    // Better: fetch /me here
                    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUser(response.data);
                } catch (error) {
                    console.error("Auth check failed", error);
                    setAuthToken(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = (token: string, userData: User) => {
        setAuthToken(token);
        setUser(userData);
    };

    const logout = () => {
        setAuthToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
