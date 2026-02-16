import React from 'react';
import { useAuth } from '../context/AuthContext';

const Landing: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Welcome to Daily Placement Training PWA</h1>
            {user ? (
                <div>
                    <p>Hello, {user.name}!</p>
                    <button onClick={logout} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Logout</button>
                </div>
            ) : (
                <div>
                    <p>Please log in to continue.</p>
                    <a href="/login" style={{ marginRight: '1rem' }}>Login</a>
                    <a href="/register">Register</a>
                </div>
            )}
        </div>
    );
};

export default Landing;
