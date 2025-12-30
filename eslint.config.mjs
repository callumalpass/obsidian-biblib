import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser
            },
            parserOptions: {
                project: './tsconfig.json'
            }
        },
        rules: {
            // Match the rules from the original .eslintrc
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
            '@typescript-eslint/ban-ts-comment': 'off',
            'no-prototype-builtins': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            // Additional recommended rules that were implicitly enabled
            '@typescript-eslint/no-explicit-any': 'warn'
        }
    },
    {
        // Ignore patterns
        ignores: [
            'node_modules/**',
            'main.js',
            '*.config.js',
            '*.config.mjs',
            'dist/**',
            'coverage/**'
        ]
    }
);
