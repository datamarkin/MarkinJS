import terser from '@rollup/plugin-terser';

export default [
    // IIFE build (for browsers, non-minified)
    {
        input: 'markin.js',
        output: {
            file: 'dist/markin.js',
            format: 'iife',
            name: 'MarkinJS',
            exports: 'default',
        },
    },
    // IIFE build (minified with source maps)
    {
        input: 'markin.js',
        output: {
            file: 'dist/markin.min.js',
            format: 'iife',
            name: 'MarkinJS',
            exports: 'default',
            sourcemap: true,
            plugins: [terser()],
        },
    },
    // ESM build
    {
        input: 'markin.js',
        output: {
            file: 'dist/markin.esm.js',
            format: 'es',
        },
    },
    // CJS build
    {
        input: 'markin.js',
        output: {
            file: 'dist/markin.cjs.js',
            format: 'cjs',
            exports: 'default',
        },
    },
];
