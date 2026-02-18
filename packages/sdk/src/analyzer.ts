import { Analyzer, AnalysisContext } from '@codegenome-x/core';

/**
 * Base class for custom analyzers
 * Extend this class to create your own analyzer
 */
export abstract class BaseAnalyzer implements Analyzer {
  abstract name: string;
  abstract supportedExtensions: string[];
  abstract analyze(context: AnalysisContext): Promise<void>;

  /**
   * Helper method to extract line number from content and index
   */
  protected getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Helper method to calculate lines of code
   */
  protected calculateLOC(content: string, startIndex: number, endIndex: number): number {
    const block = content.substring(startIndex, endIndex);
    return block.split('\n').length;
  }

  /**
   * Helper method to generate unique node ID
   */
  protected generateNodeId(filePath: string, type: string, name: string, line: number): string {
    return `${filePath}:${type}:${name}:${line}`;
  }

  /**
   * Helper method to add node to graph
   */
  protected addNode(
    context: AnalysisContext,
    type: string,
    name: string,
    line: number,
    column: number,
    loc: number,
    metadata: Record<string, unknown> = {}
  ): string {
    const nodeId = this.generateNodeId(context.filePath, type, name, line);
    
    context.graph.addNode({
      id: nodeId,
      type,
      name,
      filePath: context.filePath,
      line,
      column,
      metadata,
      loc,
      dependencies: new Set(),
      dependents: new Set(),
    });
    
    return nodeId;
  }

  /**
   * Helper method to add edge between nodes
   */
  protected addEdge(
    context: AnalysisContext,
    fromId: string,
    toId: string,
    edgeType: string,
    metadata: Record<string, unknown> = {}
  ): void {
    context.graph.addEdge(fromId, toId, edgeType, metadata);
  }
}

/**
 * Plugin manager for loading and managing custom analyzers
 */
export class PluginManager {
  private analyzers: Map<string, Analyzer> = new Map();

  /**
   * Register a custom analyzer
   */
  registerAnalyzer(analyzer: Analyzer): void {
    this.analyzers.set(analyzer.name, analyzer);
  }

  /**
   * Unregister an analyzer
   */
  unregisterAnalyzer(name: string): void {
    this.analyzers.delete(name);
  }

  /**
   * Get all registered analyzers
   */
  getAnalyzers(): Analyzer[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Get analyzer by name
   */
  getAnalyzer(name: string): Analyzer | undefined {
    return this.analyzers.get(name);
  }

  /**
   * Find analyzer for file extension
   */
  findAnalyzer(filePath: string): Analyzer | undefined {
    return Array.from(this.analyzers.values()).find(analyzer =>
      analyzer.supportedExtensions.some(ext => filePath.endsWith(ext))
    );
  }
}

/**
 * Utility functions for common analysis tasks
 */
export class AnalysisUtils {
  /**
   * Find all matches of a regex pattern in content
   */
  static findMatches(content: string, regex: RegExp): RegExpExecArray[] {
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    
    // Reset regex lastIndex
    regex.lastIndex = 0;
    
    while ((match = regex.exec(content)) !== null) {
      matches.push(match);
      if (!regex.global) break;
    }
    
    return matches;
  }

  /**
   * Extract block content (e.g., function body, class body)
   */
  static extractBlock(content: string, startIndex: number, openChar = '{', closeChar = '}'): string | null {
    let depth = 0;
    let inBlock = false;
    let blockStart = -1;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === openChar) {
        depth++;
        if (!inBlock) {
          inBlock = true;
          blockStart = i;
        }
      } else if (content[i] === closeChar) {
        depth--;
        if (inBlock && depth === 0) {
          return content.substring(blockStart, i + 1);
        }
      }
    }
    
    return null;
  }

  /**
   * Simple AST walker for basic parsing
   */
  static walkAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    callback(node);
    
    // Walk through all properties
    for (const key in node) {
      if (key === 'parent') continue; // Avoid circular references
      
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child => this.walkAST(child, callback));
      } else if (value && typeof value === 'object') {
        this.walkAST(value, callback);
      }
    }
  }

  /**
   * Calculate cyclomatic complexity for a block of code
   */
  static calculateCyclomaticComplexity(content: string): number {
    const complexityKeywords = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\|\|\b/g,
      /\?\s*:/g, // ternary operator
    ];
    
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(regex => {
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * Detect code smells in content
   */
  static detectCodeSmells(content: string): string[] {
    const smells: string[] = [];
    
    // Long parameter list
    const longParamRegex = /function\s+\w+\s*\([^)]{100,}\)/;
    if (longParamRegex.test(content)) {
      smells.push('Long parameter list');
    }
    
    // Long method (rough estimation)
    const lines = content.split('\n').length;
    if (lines > 50) {
      smells.push('Long method');
    }
    
    // Deep nesting
    const maxIndentation = content.split('\n').reduce((max, line) => {
      const indentation = line.match(/^(\s*)/)?.[1].length || 0;
      return Math.max(max, indentation);
    }, 0);
    
    if (maxIndentation > 24) { // 6 levels of indentation assuming 4 spaces
      smells.push('Deep nesting');
    }
    
    // Duplicate code (simple check for repeated lines)
    const lineCounts = new Map<string, number>();
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 10) { // Only consider substantial lines
        lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
      }
    });
    
    const duplicates = Array.from(lineCounts.entries())
      .filter(([, count]) => count > 3)
      .map(([line]) => line);
    
    if (duplicates.length > 0) {
      smells.push('Possible duplicate code');
    }
    
    return smells;
  }
}