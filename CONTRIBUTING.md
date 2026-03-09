# Contributing to MarkinJS

Thank you for your interest in contributing to MarkinJS! This guide will help you get started.

## Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/datamarkin/markinjs.git
cd markinjs
```

2. **Install dependencies**

```bash
npm install
```

3. **Run development server**

Open `examples/index.html` in your browser to test changes interactively.

4. **Run tests**

```bash
npm test
```

5. **Build**

```bash
npm run build
```

## Project Structure

```
markinjs/
  markin.js          # Main source file
  dist/              # Built output (IIFE, ESM, CJS, minified)
  tests/             # Test files
  examples/          # Interactive demos
  package.json
  rollup.config.mjs  # Build configuration
```

## Making Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes to `markin.js` (the source file).

3. Run lint and fix any issues:
   ```bash
   npm run lint:fix
   ```

4. Write or update tests in `tests/`.

5. Run the full test suite:
   ```bash
   npm test
   ```

6. Build to verify the output:
   ```bash
   npm run build
   ```

7. Test manually with the examples in `examples/index.html`.

## Pull Request Process

1. Update `CHANGELOG.md` with a description of your changes.
2. Ensure all tests pass and lint is clean.
3. Open a pull request against the `main` branch.
4. Fill out the PR template with a clear description of changes.
5. Wait for review from a maintainer.

## Code Style

- Use ES6+ features (classes, arrow functions, template literals, etc.)
- Follow the existing code patterns in `markin.js`
- Run `npm run lint:fix` before committing
- Use meaningful variable and function names
- Add comments for complex logic

## Reporting Bugs

Use [GitHub Issues](https://github.com/datamarkin/markinjs/issues) with the bug report template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Code snippet or demo link if possible

## Feature Requests

Open a [GitHub Issue](https://github.com/datamarkin/markinjs/issues) with the feature request template. Describe:

- The use case
- Expected API/behavior
- Any alternatives considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
