# Contributing to CodeGenome X

Thank you for your interest in contributing to CodeGenome X! This guide will help you get started with development.

## Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/codegenome-x.git
cd codegenome-x

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
codegenome-x/
├── packages/
│   ├── core/           # Core analysis engine
│   ├── cli/            # Command-line interface
│   ├── vscode-extension/ # VS Code extension
│   └── sdk/            # Plugin development kit
├── examples/           # Usage examples
├── benchmarks/         # Performance benchmarks
└── docs/              # Documentation
```

## Development Workflow

### Package Development

Each package is developed independently:

```bash
# Work on core package
cd packages/core
pnpm dev

# Work on CLI package  
cd packages/cli
pnpm dev

# Work on VS Code extension
cd packages/vscode-extension
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/core
pnpm test

# Run tests with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

### Linting and Type Checking

```bash
# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Fix linting issues
pnpm lint --fix
```

## Adding New Features

### Adding a New Analyzer

1. Create analyzer in appropriate package
2. Implement `Analyzer` interface
3. Add to analyzer registry
4. Write tests
5. Update documentation

Example:
```typescript
// packages/core/src/analyzers/my-analyzer.ts
import { Analyzer, AnalysisContext } from '../types';

export class MyAnalyzer implements Analyzer {
  name = 'MyAnalyzer';
  supportedExtensions = ['.myext'];
  
  async analyze(context: AnalysisContext): Promise<void> {
    // Implementation
  }
}
```

### Adding SDK Features

1. Implement in `packages/sdk`
2. Export from main index
3. Add examples
4. Write tests
5. Update SDK documentation

## Code Standards

### TypeScript Guidelines

- Use strict mode
- Avoid `any` type
- Use explicit return types
- Document public APIs
- Follow existing naming conventions

### Testing Guidelines

- Minimum 80% coverage
- Test both success and error cases
- Use descriptive test names
- Mock external dependencies
- Test edge cases

### Performance Guidelines

- Profile before optimizing
- Use worker threads for CPU-intensive tasks
- Implement incremental caching
- Avoid blocking the event loop
- Handle large files gracefully

## Pull Request Process

### Before Submitting

1. Run all tests: `pnpm test`
2. Check linting: `pnpm lint`
3. Type check: `pnpm typecheck`
4. Update documentation
5. Add tests for new features

### PR Requirements

- Clear description of changes
- Link to related issues
- Tests included
- Documentation updated
- No breaking changes (unless approved)

### Review Process

1. Automated checks must pass
2. Code review by maintainers
3. Performance impact considered
4. Security implications reviewed
5. Merge after approval

## Release Process

### Versioning

We use semantic versioning:
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

### Publishing

```bash
# Version packages
pnpm version

# Publish to npm
pnpm publish

# Create release notes
pnpm release
```

## Getting Help

- Check existing issues
- Ask in discussions
- Join our community chat
- Contact maintainers

## Code of Conduct

Please follow our Code of Conduct:
- Be respectful
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints
- Follow project guidelines

Thank you for contributing to CodeGenome X!