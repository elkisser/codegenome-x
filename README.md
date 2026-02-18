# CodeGenome X

Professional multi-language structural analysis engine for detecting dead code, calculating impact scores, and simulating safe code removal.

## Features

- 🔍 **Multi-language Support**: JavaScript, TypeScript, React, Symfony, Vue, Python, Java
- 🕸️ **Graph-based Analysis**: Complete structural dependency graph
- 💀 **Dead Code Detection**: Cross-layer dead code identification
- ⚡ **Impact Scoring**: Intelligent impact calculation with multiple factors
- 🔮 **Safe Removal Simulation**: Predict consequences before removing code
- 🚀 **High Performance**: Worker threads, parallel processing, incremental caching
- 🔧 **Extensible**: Plugin SDK for custom analyzers
- 🎯 **Editor Integration**: VS Code extension with modern webview
- 📊 **CLI Interface**: Command-line tool for CI/CD integration

## Installation

### CLI Tool
```bash
npm install -g @codegenome-x/cli
```

### VS Code Extension
Install from VS Code marketplace or build from source.

### Core Library
```bash
npm install @codegenome-x/core
```

## Quick Start

### CLI Usage
```bash
# Analyze current project
codegenome analyze

# Analyze specific directory
codegenome analyze ./src

# Export results to JSON
codegenome analyze --output results.json

# Simulate node removal
codegenome simulate <node-id>
```

### Programmatic Usage
```typescript
import { AnalysisEngine } from '@codegenome-x/core';

const engine = new AnalysisEngine();
const result = await engine.analyze({
  projectPath: './my-project',
  includePatterns: ['**/*.{ts,tsx,js,jsx}'],
  excludePatterns: ['node_modules/**'],
  maxWorkers: 4,
  enableCache: true,
});

console.log('Analysis complete:', result.stats);

// Simulate node removal
const simulation = result.graph.removeNodeSimulation('node-id');
console.log('Impact score:', simulation.impactScore);
```

## Architecture

### Core Components

- **Graph Engine**: High-performance dependency graph with Map-based structures
- **Analyzer System**: Pluggable analyzer architecture for different languages
- **Impact Engine**: Multi-factor impact scoring algorithm
- **Risk Engine**: Safe removal simulation and consequence prediction
- **Performance Layer**: Worker threads, parallel processing, incremental caching

### Impact Score Calculation

```
impactScore = (LOC * 0.4) + (fanOut * 3) + (fanIn * 2) + (dependencyDepth * 2)
```

**Impact Levels:**
- Low: < 10
- Medium: 10-50  
- High: 50-100
- Critical: > 100

## SDK Development

### Creating Custom Analyzers

```typescript
import { BaseAnalyzer } from '@codegenome-x/sdk';

class MyAnalyzer extends BaseAnalyzer {
  name = 'MyAnalyzer';
  supportedExtensions = ['.myext'];

  async analyze(context: AnalysisContext): Promise<void> {
    // Your analysis logic here
    const nodeId = this.addNode(context, 'my_type', 'name', 1, 0, 10);
    this.addEdge(context, nodeId, 'other_node', 'dependency');
  }
}
```

### Plugin Registration

```typescript
import { PluginManager } from '@codegenome-x/sdk';

const pluginManager = new PluginManager();
pluginManager.registerAnalyzer(new MyAnalyzer());

// Use with core engine
engine.addAnalyzer(new MyAnalyzer());
```

## Performance

- **Scalability**: Handles 10k+ nodes without significant degradation
- **Parallel Processing**: Worker threads for file analysis
- **Incremental Caching**: Hash-based caching for unchanged files
- **Memory Efficient**: Map-based data structures, streaming analysis

## Supported Languages

### Built-in Analyzers

- **TypeScript/JavaScript**: Functions, classes, imports, exports
- **React**: Components, hooks, JSX usage
- **Symfony**: Controllers, services, entities, repositories, routes
- **Endpoints**: Express, Next.js, Symfony routes, API calls

### SDK Analyzers

- **Vue.js**: Components, directives, lifecycle hooks
- **Python**: Classes, functions, imports
- **Java**: Classes, methods, annotations

## Configuration

### VS Code Settings

```json
{
  "codegenome.enableAutoAnalysis": false,
  "codegenome.maxWorkers": 4,
  "codegenome.includePatterns": ["**/*.{ts,tsx,js,jsx,php}"],
  "codegenome.excludePatterns": ["node_modules/**", "dist/**", "build/**", ".git/**"]
}
```

### CLI Options

```bash
codegenome analyze [path] [options]

Options:
  -o, --output <path>     Output file for JSON results
  -f, --format <format>   Output format (json|table)
  --include <patterns>    File patterns to include
  --exclude <patterns>    File patterns to exclude  
  --workers <number>      Number of worker threads
  --no-cache             Disable caching
```

## Contributing

See [Contributing Guide](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Roadmap

- [ ] Additional language support (Go, Rust, C#)
- [ ] Machine learning-based impact prediction
- [ ] Integration with popular IDEs (IntelliJ, Vim)
- [ ] Web-based dashboard
- [ ] Advanced dead code detection algorithms
- [ ] Team collaboration features