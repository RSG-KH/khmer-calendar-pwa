import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages supplies its project path; local development uses the site root.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [{
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            "script-src 'self'",
            // The UI uses inline styles for layout, theme colors and watermarks.
            "style-src 'self' 'unsafe-inline'",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'self'",
            "frame-src 'none'"
          ].join('; ')
        },
        injectTo: 'head-prepend'
      }];
    }
  }],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  }
});
