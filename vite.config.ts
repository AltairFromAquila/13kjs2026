import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Prefer modern syntax so minification can be more effective.
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false,
    },
    terserOptions: {
      compress: {
        passes: 5,
        toplevel: true,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        booleans_as_integers: true,
        dead_code: true,
        unsafe: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
      },
      mangle: {
        toplevel: true,
        safari10: true,
        properties: {
          // Max-aggressive test mode: mangle nearly all property keys.
          regex: /^./,
          keep_quoted: false,
          builtins: false,
          undeclared: true,
          debug: false,
          reserved: [],
        },
      },
      format: {
        comments: false,
        ascii_only: true,
      },
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    // In Vite 8/Rolldown, this replaces inlineDynamicImports for single-chunk output.
    codeSplitting: false,
  },
  esbuild: {
    legalComments: 'none',
  },
});
