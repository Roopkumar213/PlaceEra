/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
                display: ['Space Grotesk', 'sans-serif'],
            },
            colors: {
                void: '#050505',
                nebula: '#0A0A0C',
                plasma: '#6E44FF',
                plasmaHover: '#8A65FF',
                data: '#2892D7',
                success: '#00F0FF',
                error: '#FF2A6D',
                glassBorder: 'rgba(255, 255, 255, 0.08)',
            },
            backgroundImage: {
                'glass-panel': 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
            }
        },
    },
    plugins: [],
}
