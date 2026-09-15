/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                base: 'var(--c-base)',
                panel: 'var(--c-panel)',
                raised: 'var(--c-raised)',
                hover: 'var(--c-hover)',
                line: 'var(--c-line)',
                'line-strong': 'var(--c-line-strong)',
                ink: 'var(--c-text-primary)',
                'ink-soft': 'var(--c-text-secondary)',
                'ink-muted': 'var(--c-text-muted)',
                'ink-subtle': 'var(--c-text-subtle)',
                accent: {
                    DEFAULT: 'var(--c-accent)',
                    hover: 'var(--c-accent-hover)',
                    active: 'var(--c-accent-active)',
                    soft: 'var(--c-accent-soft)',
                    ring: 'var(--c-accent-ring)',
                    ink: 'var(--c-accent-ink)',
                },
                danger: 'var(--c-danger)',
            },
        },
    },
    plugins: [],
}
