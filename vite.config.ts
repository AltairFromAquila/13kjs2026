import { defineConfig } from 'vite';

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
  esbuild: {
    // legalComments: 'none',
  },
});
