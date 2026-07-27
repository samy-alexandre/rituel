import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// ESLint (flat config) — scopé au NOUVEAU code modulaire src/ uniquement.
// Le code hérité (public/app.legacy.js), transitoire, n'est volontairement pas linté ;
// il disparaîtra au fil de l'extraction. api/ (serverless) a son propre contexte.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'api/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Modules features/ = domaines déplacés VERBATIM du monolithe (Phase B), qui s'appuient
    // encore sur le pont window (globales sb/currentUser/showToast…) et conservent des patterns
    // hérités (catch vides…). On assouplit le temps de leur modularisation complète ; le code
    // NEUF que j'écris (core/, ui/, data/) reste sous les règles strictes ci-dessus.
    files: ['src/features/**/*.js'],
    rules: {
      'no-undef': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
    },
  },
  prettier, // désactive les règles ESLint qui entreraient en conflit avec Prettier
];
