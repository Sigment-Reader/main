// client/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',

    // FIX 1: Remove redundant 'client/' prefix
    './src/**/*.{js,ts,jsx,tsx}',

    // FIX 2: Remove redundant 'client/' prefix
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
