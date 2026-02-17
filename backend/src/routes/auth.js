const path = require('path');
// Correctly point to backend/.env (two levels up from src/routes)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Fallback for demo purposes if .env fails to load
if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not found in environment, using fallback for demo.');
    process.env.JWT_SECRET = 'fallback_demo_secret_ensure_env_is_loaded';
}
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// Set up Nodemailer transporter (Configure with your email service)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Example: Use Gmail, or configure SMTP
    auth: {
        user: process.env.EMAIL_USER, // e.g., 'your-email@gmail.com'
        pass: process.env.EMAIL_PASS  // e.g., 'your-app-password'
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            passwordHash
        });

        await user.save();

        const payload = {
            id: user.id
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // DEMO LOGIN BYPASS
        if (email === 'demo@elevare.com' && password === 'demo123') {
            const payload = { id: 'demo-user-id' };

            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '30d' },
                (err, token) => {
                    if (err) throw err;
                    res.json({
                        token,
                        user: {
                            id: 'demo-user-id',
                            name: 'Demo User',
                            email: 'demo@elevare.com'
                        }
                    });
                }
            );
            return;
        }

        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const payload = {
            id: user.id
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Should theoretically return 200 to prevent enumeration, but for UX we can return 404 or generic
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate token
        const token = crypto.randomBytes(20).toString('hex');

        // Set token and expiration (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Create reset URL
        // Assuming frontend is on port 5173 or 5174, adjust as needed or use env var
        const resetUrl = `http://localhost:5173/reset-password/${token}`;

        const mailOptions = {
            from: `"Antigravity Auth" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Secure Identity Recovery // ELEVARE.AI',
            html: `
            <div style="background-color: #050505; color: #ffffff; font-family: 'Courier New', monospace; padding: 40px; text-align: center;">
                <h1 style="color: #6E44FF; font-size: 24px; letter-spacing: 2px;">ELEVARE.AI</h1>
                <div style="border: 1px solid rgba(255,255,255,0.1); background-color: #0A0A0C; padding: 30px; border-radius: 12px; margin: 20px auto; max-width: 500px;">
                    <h2 style="color: #ffffff; margin-bottom: 20px;">Identity Recovery Protocol</h2>
                    <p style="color: #cccccc; font-size: 14px; line-height: 1.6;">
                        A request was initiated to reset the credentials for this neural link.
                        If this was you, proceed using the secure channel below.
                    </p>
                    <a href="${resetUrl}" style="display: inline-block; background-color: #6E44FF; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 20px; text-transform: uppercase; letter-spacing: 1px;">
                        Reset Credentials
                    </a>
                    <p style="color: #555555; font-size: 12px; margin-top: 20px;">
                        This link will self-destruct in 60 minutes.
                    </p>
                </div>
                <div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">
                    <p style="color: #6E44FF; font-weight: bold; font-size: 16px;">Founder A ROOP KUMAR</p>
                    <p style="color: #444; font-size: 10px;">ANTIGRAVITY SYSTEMS v2.0</p>
                </div>
            </div>
            `
        };

        if (process.env.NODE_ENV !== 'test') { // Skip sending in test if not mocked
            await transporter.sendMail(mailOptions);
        }

        console.log(`[Forgot Password] Token generated for ${email}: ${token}`);

        res.json({ message: 'Recovery signal sent.' });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token is invalid or has expired' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(password, salt);

        // Clear reset token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        // Optionally send confirmation email

        res.json({ message: 'Password has been reset successfully.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    try {
        if (req.user.id === 'demo-user-id') {
            return res.json({
                id: 'demo-user-id',
                name: 'Demo User',
                email: 'demo@elevare.com',
                streak: 42
            });
        }

        const user = await User.findById(req.user.id).select('-passwordHash');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
