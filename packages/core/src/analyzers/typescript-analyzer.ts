import { Analyzer, AnalysisContext } from '../types.js';
import { parse } from '@typescript-eslint/typescript-estree';

export class TypeScriptAnalyzer implements Analyzer {
  name = 'TypeScriptAnalyzer';
  supportedExtensions = ['.ts', '.tsx'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content } = context;
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        tokens: false,
        comment: false,
        jsx: filePath.endsWith('.tsx'),
      });

      this.walkAST(ast, context);
    } catch (error) {
      console.warn(`Failed to parse TypeScript file: ${filePath}`, error);
    }
  }

  private walkAST(node: any, context: AnalysisContext): void {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'FunctionDeclaration':
      case 'MethodDefinition':
        this.processFunction(node, context);
        break;
      case 'ClassDeclaration':
        this.processClass(node, context);
        break;
      case 'ImportDeclaration':
        this.processImport(node, context);
        break;
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        this.processExport(node, context);
        break;
    }

    // Recursively walk through all properties
    for (const key in node) {
      if (key === 'parent') continue; // Avoid circular references
      
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child => this.walkAST(child, context));
      } else if (value && typeof value === 'object') {
        this.walkAST(value, context);
      }
    }
  }

  private processFunction(node: any, context: AnalysisContext): void {
    const { graph, filePath } = context;
    const name = node.id?.name || 'anonymous';
    const loc = node.loc?.end.line - node.loc?.start.line || 0;
    
    const nodeId = `${filePath}:${name}:${node.loc?.start.line || 0}`;
    
    graph.addNode({
      id: nodeId,
      type: 'function',
      name,
      filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      metadata: {
        kind: node.type,
        async: node.async || false,
        generator: node.generator || false,
      },
      loc,
      dependencies: new Set(),
      dependents: new Set(),
    });
  }

  private processClass(node: any, context: AnalysisContext): void {
    const { graph, filePath } = context;
    const name = node.id?.name || 'anonymous';
    const loc = node.loc?.end.line - node.loc?.start.line || 0;
    
    const nodeId = `${filePath}:${name}:${node.loc?.start.line || 0}`;
    
    graph.addNode({
      id: nodeId,
      type: 'class',
      name,
      filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      metadata: {
        kind: node.type,
        abstract: node.abstract || false,
      },
      loc,
      dependencies: new Set(),
      dependents: new Set(),
    });
  }

  private processImport(node: any, context: AnalysisContext): void {
    const { graph, filePath } = context;
    const source = node.source?.value;
    
    if (!source) return;
    
    const loc = node.loc?.end.line - node.loc?.start.line || 0;
    const nodeId = `${filePath}:import:${source}:${node.loc?.start.line || 0}`;
    
    graph.addNode({
      id: nodeId,
      type: 'import',
      name: source,
      filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      metadata: {
        source,
        specifiers: node.specifiers?.map((spec: any) => spec.imported?.name || spec.local?.name),
      },
      loc,
      dependencies: new Set(),
      dependents: new Set(),
    });
  }

  private processExport(node: any, context: AnalysisContext): void {
    const { graph, filePath } = context;
    const declaration = node.declaration;
    
    if (!declaration) return;
    
    const name = declaration.id?.name || 'default';
    const loc = node.loc?.end.line - node.loc?.start.line || 0;
    const nodeId = `${filePath}:export:${name}:${node.loc?.start.line || 0}`;
    
    graph.addNode({
      id: nodeId,
      type: 'export',
      name,
      filePath,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      metadata: {
        kind: node.type,
        declaration: declaration.type,
      },
      loc,
      dependencies: new Set(),
      dependents: new Set(),
    });
  }
}