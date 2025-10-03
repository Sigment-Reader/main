// client/postcss.config.cjs (REVERTED TO STABLE V3 CONFIG)

module.exports = {
  plugins: {
    // Use the V3 plugin name, which is now installed:
    tailwindcss: {},
    // Autoprefixer is required for this configuration format to be valid
    autoprefixer: {},
    // You can leave nesting if you use it, or remove this line if you don't:
    // '@tailwindcss/nesting': {},
  },
};
