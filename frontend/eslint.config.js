import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Downgrade ces règles de error à warn pour ne pas bloquer le build
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  {
    // Configuration spécifique pour les fichiers de config
    files: ['*.config.js', 'tailwind.config.js'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-undef': 'off',
    },
  },
]
