import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { Bell, Mail, Clock, CalendarDays, Globe, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const [emailEnabled, setEmailEnabled] = useState(false);
    const [preferredTime, setPreferredTime] = useState('09:00');
    const [frequency, setFrequency] = useState('DAILY');
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

    const [pushEnabled, setPushEnabled] = useState(false);

    useEffect(() => {
        const fetchPreferences = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedUser = res.data;
                setTimezone(fetchedUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

                if (fetchedUser.emailPreferences) {
                    setEmailEnabled(fetchedUser.emailPreferences.enabled || false);
                    setPreferredTime(fetchedUser.emailPreferences.preferredTime || '09:00');
                    setFrequency(fetchedUser.emailPreferences.frequency || 'DAILY');
                }

                if (fetchedUser.notificationPreferences) {
                    setPushEnabled(fetchedUser.notificationPreferences.browser || false);
                }
            } catch (err) {
                console.error("Failed to load settings", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPreferences();
    }, []);

    const handlePushToggle = async () => {
        if (!pushEnabled) {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    setPushEnabled(true);
                } else {
                    alert('Browser notifications denied. Check your browser settings.');
                }
            } else {
                alert('Your browser does not support notifications.');
            }
        } else {
            setPushEnabled(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMsg('');
        try {
            const token = localStorage.getItem('token');
            const isOnboarding = !(user?.onboardingComplete);

            const url = isOnboarding
                ? `${import.meta.env.VITE_API_BASE_URL}/api/auth/onboarding`
                : `${import.meta.env.VITE_API_BASE_URL}/api/auth/settings`;

            const payload = {
                timezone,
                emailPreferences: {
                    enabled: emailEnabled,
                    preferredTime,
                    frequency,
                    timezone
                },
                notificationPreferences: {
                    browser: pushEnabled
                }
            };

            await axios.put(url, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccessMsg('Preferences saved successfully.');
            if (isOnboarding) {
                // Quick reload to update global context safely
                window.location.href = '/';
            }

            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            console.error('Failed to save settings', err);
        } finally {
            setSaving(false);
        }
    };

    // Next scheduled sync preview calculation
    let nextScheduledStr = 'Inactive';
    if (emailEnabled && preferredTime) {
        const now = new Date();
        const [h, m] = preferredTime.split(':').map(Number);

        let target = new Date(now);
        target.setHours(h, m, 0, 0);

        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }

        if (frequency === 'WEEKDAYS') {
            const d = target.getDay();
            if (d === 6) target.setDate(target.getDate() + 2); // Saturday -> Monday
            if (d === 0) target.setDate(target.getDate() + 1); // Sunday -> Monday
        }

        nextScheduledStr = `${target.toLocaleDateString()} at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    if (loading) return <div className="p-8">Loading preferences...</div>;

    const isOnboarding = !(user?.onboardingComplete);

    return (
        <PageContainer>
            <div className="max-w-2xl mx-auto space-y-8 mt-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">
                        {isOnboarding ? 'Finish Your Setup' : 'Neural Settings'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isOnboarding
                            ? 'Configure your daily sync schedule to activate your learning journey.'
                            : 'Manage your automated learning triggers and notifications.'}
                    </p>
                </div>

                <Card className="border-border shadow-md rounded-2xl overflow-hidden">
                    <div className="bg-primary/5 p-6 border-b border-border flex items-center gap-4">
                        <Mail className="text-primary w-6 h-6" />
                        <h2 className="text-xl font-bold">Daily Email Automation</h2>
                    </div>
                    <CardContent className="p-6 space-y-6">

                        {/* Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">Enable Daily Delivery</h3>
                                <p className="text-sm text-muted-foreground">Receive your daily session link securely via email.</p>
                            </div>
                            <button
                                onClick={() => setEmailEnabled(!emailEnabled)}
                                className={`w-14 h-8 rounded-full transition-colors relative ${emailEnabled ? 'bg-primary' : 'bg-muted border border-border'}`}
                            >
                                <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {emailEnabled && (
                            <div className="pt-4 border-t border-border space-y-6 px-4 pb-4 bg-muted/20 rounded-xl">

                                {/* Time Picker */}
                                <div>
                                    <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                                        <Clock size={16} className="text-muted-foreground" />
                                        Preferred Delivery Time
                                    </label>
                                    <input
                                        type="time"
                                        value={preferredTime}
                                        onChange={(e) => setPreferredTime(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-4 py-2 w-full text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>

                                {/* Frequency */}
                                <div>
                                    <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                                        <CalendarDays size={16} className="text-muted-foreground" />
                                        Trigger Frequency
                                    </label>
                                    <select
                                        value={frequency}
                                        onChange={(e) => setFrequency(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-4 py-2 w-full text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="DAILY">Daily (7 days a week)</option>
                                        <option value="WEEKDAYS">Weekdays (Mon-Fri only)</option>
                                    </select>
                                </div>

                                {/* Timezone Preview */}
                                <div>
                                    <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                                        <Globe size={16} className="text-muted-foreground" />
                                        Timezone (Auto-detected)
                                    </label>
                                    <input
                                        type="text"
                                        value={timezone}
                                        onChange={(e) => setTimezone(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-4 py-2 w-full text-muted-foreground cursor-not-allowed"
                                        disabled
                                    />
                                    <div className="mt-4 p-3 bg-primary/10 border border-primary/20 text-primary text-sm rounded-lg flex items-center justify-center font-medium">
                                        Next dispatch: {nextScheduledStr}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Browser Notification Component */}
                <Card className="border-border shadow-md rounded-2xl overflow-hidden mt-6">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="p-3 bg-muted rounded-full shrink-0">
                                    <Bell className="text-foreground w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Browser Push Triggers</h3>
                                    <p className="text-sm text-muted-foreground">Receive passive alerts immediately when your session generates.</p>
                                </div>
                            </div>
                            <button
                                onClick={handlePushToggle}
                                className={`w-14 h-8 rounded-full transition-colors relative shrink-0 ${pushEnabled ? 'bg-primary' : 'bg-muted border border-border'}`}
                            >
                                <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-8 pt-4 border-t border-border">
                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full md:w-auto px-8"
                    >
                        {saving ? 'Synching...' : isOnboarding ? 'Complete Setup' : 'Save Configurations'}
                    </Button>

                    {successMsg && (
                        <span className="text-green-500 font-medium flex items-center gap-2 text-sm animate-in fade-in">
                            <CheckCircle2 size={16} /> {successMsg}
                        </span>
                    )}
                </div>

            </div>
        </PageContainer>
    );
};

export default Settings;
