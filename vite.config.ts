import { defineConfig } from 'vite';
import htmlMinifier from 'vite-plugin-html-minifier';

export default defineConfig({
  build: {
    // Prefer modern syntax so minification can be more effective.
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false,
    },
    terserOptions: {
      toplevel: true,
      nameCache: {},
      ecma: 2025,
      module: true,
      format: {
        comments: false,
        beautify: false,
      },
      compress: {
        booleans_as_integers: true,
        passes: 5,
      },
      mangle: {
        properties: {
            regex: /.+/
        },
        module: true
      },
    },
    // In Vite 8/Rolldown, this replaces inlineDynamicImports for single-chunk output.
    // codeSplitting: false,
  },
  worker: {
    format: 'es',
    rolldownOptions: {
      output: {
        minify: true
      }
    }
  },
  plugins: [
    htmlMinifier({
      minify: true,
    })
  ],
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
