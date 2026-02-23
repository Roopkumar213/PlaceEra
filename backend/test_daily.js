const axios = require('axios');
const fs = require('fs');

(async () => {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'testsetup@elevare.com',
            password: 'password123'
        });

        const token = loginRes.data.token;

        console.log("Fetching /api/daily/session...");
        const dailyRes = await axios.get('http://localhost:5000/api/daily/session', {
            headers: { Authorization: `Bearer ${token}` }
        });

        fs.writeFileSync('result.json', JSON.stringify(dailyRes.data, null, 2));

    } catch (err) {
        if (err.response) {
            fs.writeFileSync('result.json', JSON.stringify({ status: err.response.status, data: err.response.data }, null, 2));
        } else {
            fs.writeFileSync('result.json', JSON.stringify({ message: err.message }, null, 2));
        }
    }
})();
