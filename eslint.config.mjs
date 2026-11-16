import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        CustomEvent: 'readonly',
        ResizeObserver: 'readonly',
        module: 'readonly',
        maplibregl: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      sourceType: 'module'
    }
  },
  {
    ignores: ['node_modules/**', 'data/**', 'docs/**', 'scripts/**']
  }
];
