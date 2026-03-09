import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser
            }
        },
        plugins: {
            prettier: eslintPluginPrettier
        },
        rules: {
            ...eslintConfigPrettier.rules,
            'prettier/prettier': 'error',
            'no-unused-vars': 'warn',
            'no-console': 'warn'
        }
    }
];
