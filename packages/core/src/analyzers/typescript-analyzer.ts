import { Analyzer, AnalysisContext } from '../types.js';
import * as ts from 'typescript';
import { relative, basename } from 'path';

export class TypeScriptAnalyzer implements Analyzer {
  name = 'TypeScriptAnalyzer';
  supportedExtensions = ['.ts', '.tsx'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, projectPath, graph } = context;
    console.log(`Analyzing TS: ${filePath}`); 
    
    try {
      // Create File Node
      const relPath = relative(projectPath, filePath).replace(/\\/g, '/');
      graph.addNode({
        id: relPath,
        type: 'file',
        name: basename(filePath),
        filePath,
        line: 0,
        column: 0,
        metadata: { language: 'typescript' },
        loc: content.split('\n').length,
        dependencies: new Set(),
        dependents: new Set()
      });

      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      this.visit(sourceFile, context);
    } catch (error) {
      console.warn(`Failed to parse TypeScript file: ${filePath}`, error);
    }
  }

  private visit(node: ts.Node, context: AnalysisContext): void {
    const { graph, filePath, projectPath } = context;
    const sourceFile = node.getSourceFile();
    const relPath = relative(projectPath, filePath).replace(/\\/g, '/');

    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        const name = node.name && ts.isIdentifier(node.name) ? node.name.text : 'anonymous';
        const start = node.getStart();
        const end = node.getEnd();
        const loc = sourceFile.getLineAndCharacterOfPosition(start);
        const nodeId = `${relPath}#${name}`; // Consistent ID
        
        graph.addNode({
            id: nodeId,
            type: 'function',
            name,
            filePath,
            line: loc.line + 1,
            column: loc.character,
            metadata: { kind: 'function' },
            loc: end - start,
            dependencies: new Set(),
            dependents: new Set()
        });
    } else if (ts.isClassDeclaration(node)) {
        const name = node.name ? node.name.text : 'anonymous';
        const start = node.getStart();
        const end = node.getEnd();
        const loc = sourceFile.getLineAndCharacterOfPosition(start);
        const nodeId = `${relPath}#${name}`; // Consistent ID
        
        graph.addNode({
            id: nodeId,
            type: 'class',
            name,
            filePath,
            line: loc.line + 1,
            column: loc.character,
            metadata: { kind: 'class' },
            loc: end - start,
            dependencies: new Set(),
            dependents: new Set()
        });
    } else if (ts.isImportDeclaration(node)) {
        // ... imports don't need strict linking unless edge detector uses them
        // But edge detector creates 'imports' edge from file to file
    }

    ts.forEachChild(node, (child) => this.visit(child, context));
  }
}
