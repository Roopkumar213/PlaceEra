const nodemailer = require('nodemailer');
require('dotenv').config();

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send daily lesson notification email
 * @param {Object} user - User object with email, name
 * @param {Object} lesson - Lesson object with topic, subject
 * @returns {Promise<void>}
 */
const sendDailyLesson = async (user, lesson) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const mailOptions = {
        from: `"ELEVARE.AI" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `🚀 Today's Challenge: ${lesson?.topic || 'Your Daily Lesson'}`,
        html: `
        <div style="background-color: #050505; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; text-align: center;">
            <div style="max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6E44FF; font-size: 28px; letter-spacing: 2px; margin-bottom: 10px;">ELEVARE.AI</h1>
                <p style="color: #888; font-size: 12px; margin-bottom: 30px;">AI-Powered Placement Preparation</p>
                
                <div style="border: 1px solid rgba(110, 68, 255, 0.3); background: linear-gradient(135deg, #0A0A0C 0%, #1a1a2e 100%); padding: 30px; border-radius: 12px; margin: 20px 0;">
                    <h2 style="color: #ffffff; margin-bottom: 15px; font-size: 22px;">Hey ${user.name || 'there'}! 👋</h2>
                    <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Your daily adaptive lesson is ready. Today we're focusing on:
                    </p>
                    
                    <div style="background-color: rgba(110, 68, 255, 0.1); border-left: 4px solid #6E44FF; padding: 15px; margin: 20px 0; text-align: left;">
                        <p style="color: #6E44FF; font-weight: bold; margin: 0; font-size: 18px;">${lesson?.topic || 'Your Topic'}</p>
                        <p style="color: #888; margin: 5px 0 0 0; font-size: 14px;">${lesson?.subject || 'Subject'}</p>
                    </div>
                    
                    <p style="color: #aaa; font-size: 14px; margin-bottom: 25px;">
                        This lesson is personalized based on your mastery levels and learning patterns.
                    </p>
                    
                    <a href="${frontendUrl}/today" style="display: inline-block; background: linear-gradient(135deg, #6E44FF 0%, #5534CC 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(110, 68, 255, 0.4);">
                        Start Learning →
                    </a>
                    
                    <p style="color: #555; font-size: 12px; margin-top: 25px;">
                        ⏱️ Estimated time: 15-20 minutes
                    </p>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
                    <p style="color: #666; font-size: 11px; margin: 5px 0;">
                        You're receiving this because you enabled daily notifications.
                    </p>
                    <p style="color: #444; font-size: 10px; margin: 5px 0;">
                        ELEVARE.AI • Powered by Antigravity Systems v2.0
                    </p>
                </div>
            </div>
        </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${user.email}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`❌ Failed to send email to ${user.email}:`, error.message);
        throw error;
    }
};

/**
 * Verify email configuration
 */
const verifyEmailConfig = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email service ready');
        return true;
    } catch (error) {
        console.error('❌ Email service configuration error:', error.message);
        return false;
    }
};

module.exports = {
    sendDailyLesson,
    verifyEmailConfig
};
