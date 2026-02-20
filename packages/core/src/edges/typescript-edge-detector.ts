import * as ts from 'typescript';
import { resolve, dirname, relative } from 'path';

export interface Edge {
  source: string;
  target: string;
  type: 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'depends_on' | 'defines' | 'accesses' | 'uses_decorator';
  metadata?: Record<string, any>;
}

export class TypeScriptEdgeDetector {
  private projectRoot: string;
  private edges: Edge[] = [];
  private debug: boolean;

  constructor(projectRoot: string, debug = false) {
    this.projectRoot = projectRoot;
    this.debug = debug;
  }

  detect(filePath: string, content: string): Edge[] {
    this.edges = [];

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        this.getScriptKind(filePath)
      );

      this.visitNode(sourceFile, filePath);
      this.postProcessEdges();
    } catch (error) {
      if (this.debug) {
        console.warn(`[TSEdgeDetector] Error parsing ${filePath}:`, error);
      }
    }

    return this.edges;
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
        return ts.ScriptKind.TSX;
      case 'jsx':
        return ts.ScriptKind.JSX;
      case 'js':
        return ts.ScriptKind.JS;
      case 'ts':
      default:
        return ts.ScriptKind.TS;
    }
  }

  private postProcessEdges(): void {
    // Remove duplicate edges and self-references
    const seen = new Set<string>();
    this.edges = this.edges.filter(edge => {
      const key = `${edge.source}→${edge.target}:${edge.type}`;
      const isSelfReference = edge.source === edge.target;
      const isDuplicate = seen.has(key);
      seen.add(key);
      return !isSelfReference && !isDuplicate;
    });
  }

  private visitNode(node: ts.Node, filePath: string): void {
    // Detect imports
    if (ts.isImportDeclaration(node)) {
      this.handleImport(node, filePath);
    }

    // Detect exports
    if (ts.isExportDeclaration(node)) {
      this.handleExport(node, filePath);
    }

    // Detect class declarations
    if (ts.isClassDeclaration(node)) {
      this.handleClassDeclaration(node, filePath);
    }

    // Detect function declarations
    if (ts.isFunctionDeclaration(node)) {
      this.handleFunctionDeclaration(node, filePath);
    }

    // Detect interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      this.handleInterfaceDeclaration(node, filePath);
    }

    // Detect type aliases
    if (ts.isTypeAliasDeclaration(node)) {
      this.handleTypeAliasDeclaration(node, filePath);
    }

    // Detect function calls
    if (ts.isCallExpression(node)) {
      this.handleCallExpression(node, filePath);
    }

    // Detect property access (for method calls)
    if (ts.isPropertyAccessExpression(node)) {
      this.handlePropertyAccessExpression(node, filePath);
    }

    // Detect decorators
    const decorators = (node as any).decorators;
    if (decorators && Array.isArray(decorators)) {
      this.handleDecorators(decorators, filePath);
    }

    // Recursively visit children
    ts.forEachChild(node, (child) => this.visitNode(child, filePath));
  }

  private handleImport(node: ts.ImportDeclaration, filePath: string): void {
    const moduleSpecifier = node.moduleSpecifier;

    if (!ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const importPath = moduleSpecifier.text;
    const resolvedPath = this.resolveModulePath(importPath, filePath);

    if (resolvedPath) {
      const bindingNames = this.getImportBindingNames(node);

      this.edges.push({
        source: this.normalizePath(filePath),
        target: this.normalizePath(resolvedPath),
        type: 'imports',
        metadata: {
          imports: bindingNames,
          module: importPath,
        },
      });
    }
  }

  private handleExport(node: ts.ExportDeclaration, filePath: string): void {
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const exportPath = node.moduleSpecifier.text;
      const resolvedPath = this.resolveModulePath(exportPath, filePath);

      if (resolvedPath) {
        const exportNames = this.getExportNames(node);

        this.edges.push({
          source: this.normalizePath(filePath),
          target: this.normalizePath(resolvedPath),
          type: 'exports',
          metadata: {
            exports: exportNames,
            module: exportPath,
          },
        });
      }
    }
  }

  private handleClassDeclaration(node: ts.ClassDeclaration, filePath: string): void {
    if (!node.name) return;

    const className = node.name.text;

    // Check for extends
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const parentName = this.getEntityName(type.expression);
            if (parentName) {
              this.edges.push({
                source: `${this.normalizePath(filePath)}#${className}`,
                target: parentName,
                type: 'extends',
                metadata: { class: className },
              });
            }
          }
        }

        // Check for implements
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const type of clause.types) {
            const interfaceName = this.getEntityName(type.expression);
            if (interfaceName) {
              this.edges.push({
                source: `${this.normalizePath(filePath)}#${className}`,
                target: interfaceName,
                type: 'implements',
                metadata: { class: className },
              });
            }
          }
        }
      }
    }

    // Check constructor parameters (dependency injection)
    if (node.members) {
      for (const member of node.members) {
        if (
          ts.isConstructorDeclaration(member) &&
          member.parameters
        ) {
          for (const param of member.parameters) {
            if (param.type && ts.isTypeReferenceNode(param.type)) {
              const depName = this.getEntityName(param.type.typeName);
              if (depName && !this.isBuiltIn(depName)) {
                this.edges.push({
                  source: `${this.normalizePath(filePath)}#${className}`,
                  target: depName,
                  type: 'depends_on',
                  metadata: { 
                    class: className,
                    paramName: param.name ? this.nodeToString(param.name) : undefined,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  private handleCallExpression(node: ts.CallExpression, filePath: string): void {
    const functionName = this.getEntityName(node.expression);

    if (functionName && !this.isBuiltIn(functionName)) {
      this.edges.push({
        source: this.normalizePath(filePath),
        target: functionName,
        type: 'calls',
        metadata: {
          function: functionName,
        },
      });
    }
  }

  private getImportBindingNames(node: ts.ImportDeclaration): string[] {
    const names: string[] = [];

    if (node.importClause?.namedBindings) {
      if (ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          names.push(element.name.text);
        }
      }
    }

    if (node.importClause?.name) {
      names.push(node.importClause.name.text);
    }

    return names;
  }

  private getExportNames(node: ts.ExportDeclaration): string[] {
    const names: string[] = [];

    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        names.push(element.name.text);
      }
    }

    return names;
  }

  private getEntityName(node: ts.Expression | ts.EntityName): string | null {
    if (ts.isIdentifier(node)) {
      return node.text;
    }

    if (ts.isPropertyAccessExpression(node)) {
      const parent = this.getEntityName(node.expression);
      const property = node.name.text;
      return parent ? `${parent}.${property}` : property;
    }

    if (ts.isQualifiedName(node)) {
      const parent = this.getEntityName(node.left);
      const right = node.right.text;
      return parent ? `${parent}.${right}` : right;
    }

    return null;
  }

  private nodeToString(node: ts.Node): string {
    return node.getText ? node.getText() : 'unknown';
  }

  private resolveModulePath(importPath: string, fromFile: string): string | null {
    // Skip node builtins and external packages
    if (
      importPath.startsWith('node:') ||
      (!importPath.startsWith('.') && !importPath.startsWith('/'))
    ) {
      return null;
    }

    const baseDir = dirname(fromFile);

    // Handle relative imports
    if (importPath.startsWith('.')) {
      const resolvedPath = resolve(baseDir, importPath);

      // Try different extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
        const fullPath = resolvedPath + ext;
        // In a real implementation, we'd check if file exists
        // For now, we normalize it
        if (ext === '/index.ts' || ext === '/index.js') {
          return (resolvedPath + ext).replace(/\\/g, '/');
        }
        return fullPath.replace(/\\/g, '/');
      }
    }

    return null;
  }

  private normalizePath(path: string): string {
    return relative(this.projectRoot, path).replace(/\\/g, '/');
  }

  private handleFunctionDeclaration(node: ts.FunctionDeclaration, filePath: string): void {
    if (node.name) {
      const functionName = node.name.text;
      this.edges.push({
        source: this.normalizePath(filePath),
        target: functionName,
        type: 'defines',
        metadata: {
          type: 'function',
          name: functionName,
          async: !!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword),
          generator: !!node.asteriskToken,
        },
      });
    }
  }

  private handleInterfaceDeclaration(node: ts.InterfaceDeclaration, filePath: string): void {
    const interfaceName = node.name.text;
    this.edges.push({
      source: this.normalizePath(filePath),
      target: interfaceName,
      type: 'defines',
      metadata: {
        type: 'interface',
        name: interfaceName,
      },
    });

    // Check for extends
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const parentName = this.getEntityName(type.expression);
            if (parentName) {
              this.edges.push({
                source: `${this.normalizePath(filePath)}#${interfaceName}`,
                target: parentName,
                type: 'extends',
                metadata: { interface: interfaceName },
              });
            }
          }
        }
      }
    }
  }

  private handleTypeAliasDeclaration(node: ts.TypeAliasDeclaration, filePath: string): void {
    const typeName = node.name.text;
    this.edges.push({
      source: this.normalizePath(filePath),
      target: typeName,
      type: 'defines',
      metadata: {
        type: 'type_alias',
        name: typeName,
      },
    });
  }

  private handlePropertyAccessExpression(node: ts.PropertyAccessExpression, filePath: string): void {
    const propertyName = this.getEntityName(node);
    if (propertyName && !this.isBuiltIn(propertyName)) {
      this.edges.push({
        source: this.normalizePath(filePath),
        target: propertyName,
        type: 'accesses',
        metadata: {
          property: propertyName,
        },
      });
    }
  }

  private handleDecorators(decorators: ts.Decorator[], filePath: string): void {
    for (const decorator of decorators) {
      const decoratorName = this.getEntityName(decorator.expression);
      if (decoratorName && !this.isBuiltIn(decoratorName)) {
        this.edges.push({
          source: this.normalizePath(filePath),
          target: decoratorName,
          type: 'uses_decorator',
          metadata: {
            decorator: decoratorName,
          },
        });
      }
    }
  }

  private isBuiltIn(name: string): boolean {
    const builtIns = new Set([
      // JavaScript built-ins
      'Array', 'Object', 'String', 'Number', 'Boolean', 'Error', 'Date', 'Math', 'JSON',
      'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect',
      'Function', 'RegExp', 'Date', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array',
      'Float32Array', 'Float64Array', 'Intl', 'console', 'process', 'Buffer',
      
      // React
      'React', 'Component', 'PureComponent', 'Fragment', 'createElement', 'cloneElement',
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
      'useRef', 'useImperativeHandle', 'useLayoutEffect', 'useDebugValue',
      
      // Common decorators
      'Injectable', 'Component', 'NgModule', 'Controller', 'Get', 'Post', 'Put', 'Delete',
      'UseGuards', 'UseInterceptors', 'UsePipes', 'UseFilters',
      
      // Testing
      'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
      'jest', 'vitest', 'mocha', 'chai',
    ]);
    
    return builtIns.has(name) || name.startsWith('__') || /^[A-Z_]+$/.test(name);
  }
}