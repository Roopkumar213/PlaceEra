const User = require('../models/User');
const DailySession = require('../models/DailySession');
const nodemailer = require('nodemailer');

const startEmailScheduler = () => {
    // Run every minute
    setInterval(async () => {
        try {
            await processScheduledEmails();
        } catch (error) {
            console.error('[EmailScheduler] Unexpected error during execution loop:', error);
        }
    }, 60000);
};

// Purely local transporter or test transporter depending on ENV
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    auth: {
        user: process.env.EMAIL_USER || 'ethereal.user', // Mock defaults if unspecified
        pass: process.env.EMAIL_PASS || 'ethereal.pass',
    }
});

const generateEmailHTML = (user, session) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; background-color: #050505; color: #ffffff; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .container { max-width: 600px; margin: 40px auto; background-color: #0f0f13; border: 1px solid #222; border-radius: 12px; overflow: hidden; }
        .header { background-color: #6E44FF; padding: 30px 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; color: #fff; letter-spacing: 1px; }
        .content { padding: 40px; }
        .greeting { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
        .streak { font-size: 14px; color: #a1a1aa; margin-bottom: 30px; }
        .card { background-color: #1a1a24; border: 1px solid #333; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .badge { display: inline-block; padding: 4px 8px; background-color: rgba(110, 68, 255, 0.2); color: #c4b5fd; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
        .title { font-size: 22px; font-weight: bold; margin: 0 0 10px 0; }
        .cluster { color: #a1a1aa; font-size: 14px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .btn { display: inline-block; width: 100%; text-align: center; background-color: #22c55e; color: #fff; text-decoration: none; padding: 16px; border-radius: 8px; font-weight: bold; font-size: 16px; box-sizing: border-box; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid #222; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ELEVARE.AI</h1>
        </div>
        <div class="content">
            <div class="greeting">Daily Neural Sync Ready, ${user.name.split(' ')[0]}</div>
            <div class="streak">
                Current Streak: 🔥 <strong style="color: #fff;">${session.streakMeta?.streakDays || 0} Days</strong>
            </div>
            
            <div class="card">
                <span class="badge">${session.reason.replace(/_/g, ' ')}</span>
                <p class="cluster">${session.cluster}</p>
                <h2 class="title">${session.topic}</h2>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                    Your daily training protocol has been generated based on your learning velocity and behavioral state.
                </p>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/today?topic=${encodeURIComponent(session.topic)}" class="btn">
                Initiate Session
            </a>
        </div>
        <div class="footer">
            Antigravity Systems v2.0 • Predictive Learning Engine<br><br>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings" style="color: #6E44FF; text-decoration: none;">Manage Email Preferences</a>
        </div>
    </div>
</body>
</html>
`;

const processScheduledEmails = async () => {
    const nowUTC = new Date();

    // Convert current UTC time to a comparable format, removing seconds
    const targetTimeUTC = { hour: nowUTC.getUTCHours(), minute: nowUTC.getUTCMinutes() };

    // Find users with email enabled who haven't been emailed today
    const startOfTodayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));

    // Query users
    // Need: emailPreferences.enabled = true
    // Need: emailPreferences.preferredTime exists
    const users = await User.find({
        'emailPreferences.enabled': true,
        'emailPreferences.preferredTime': { $exists: true, $ne: null },
        $or: [
            { lastEmailSentAt: { $lt: startOfTodayUTC } },
            { lastEmailSentAt: null }
        ]
    });

    for (const user of users) {
        try {
            // Check Frequency
            if (user.emailPreferences.frequency === 'WEEKDAYS') {
                const userTz = user.emailPreferences.timezone || 'UTC';
                const options = { timeZone: userTz, weekday: 'short' };
                const dayStr = new Intl.DateTimeFormat('en-US', options).format(nowUTC);
                if (['Sat', 'Sun'].includes(dayStr)) continue; // Skip weekends
            }

            // Timezone Parsing
            // e.g. "09:30" user preferred time in their timezone
            const [prefH, prefM] = user.emailPreferences.preferredTime.split(':').map(Number);
            const userTz = user.emailPreferences.timezone || 'UTC';

            // Find current time IN user's timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: userTz,
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            const parts = formatter.formatToParts(nowUTC);
            const userCurrentH = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24; // Safari might give 24 instead of 0
            const userCurrentM = parseInt(parts.find(p => p.type === 'minute').value, 10);

            // Within a ±1 minute envelope to avoid missing due to slight lag
            const withinH = userCurrentH === prefH;
            const withinM = Math.abs(userCurrentM - prefM) <= 1;

            if (withinH && withinM) {
                // Time to send! Look for a DailySession created today for their timezone
                const todayStrUserTz = new Intl.DateTimeFormat('en-CA', {
                    timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit'
                }).format(nowUTC);

                const session = await DailySession.findOne({
                    userId: user._id,
                    dateString: todayStrUserTz
                });

                if (session) {
                    const mailOptions = {
                        from: `"Antigravity System" <${process.env.EMAIL_USER || 'no-reply@elevare'}>`,
                        to: user.email,
                        subject: `Your Daily Focus: ${session.topic}`,
                        html: generateEmailHTML(user, session)
                    };

                    if (process.env.NODE_ENV !== 'test') {
                        await transporter.sendMail(mailOptions);
                        console.log(`[EmailScheduler] Dispatched daily session email to ${user.email}`);
                    }

                    user.lastEmailSentAt = nowUTC;
                    await user.save();
                }
            }

        } catch (err) {
            console.error(`[EmailScheduler] Failed processing for user ${user._id}:`, err);
        }
    }
};

module.exports = startEmailScheduler;
