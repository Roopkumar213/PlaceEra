const axios = require('axios');

const checkHealth = async () => {
    try {
        console.log('Pinging Backend Health...');
        const res = await axios.get('http://localhost:5000/api/health');
        console.log('Health Check:', res.status, res.data);
        return true;
    } catch (err) {
        console.error('Health Check Failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('CRITICAL: Backend server is NOT running on port 5000.');
        }
        return false;
    }
};

const checkReadiness = async () => {
    try {
        // We need a token. Let's try to login as demo user to get one.
        console.log('\nAttempting Demo Login...');
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'demo@elevare.com',
            password: 'demo123'
        });

        const token = loginRes.data.token;
        console.log('Login Successful. Token obtained.');

        console.log('Requesting Readiness...');
        const readinessRes = await axios.get('http://localhost:5000/api/progress/readiness', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Readiness Check:', readinessRes.status, readinessRes.data);

    } catch (err) {
        if (err.response) {
            console.error('API Error:', err.response.status, err.response.data);
        } else {
            console.error('Network Error:', err.message);
        }
    }
};

const run = async () => {
    const isUp = await checkHealth();
    if (isUp) {
        await checkReadiness();
    }
};

run();
