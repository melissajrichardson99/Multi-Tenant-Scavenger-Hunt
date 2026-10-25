module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  rules: {
    // Components keep the classic `import React` at the top of each file.
    'no-unused-vars': ['error', { varsIgnorePattern: '^React$', caughtErrors: 'none' }],
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
  },
};
