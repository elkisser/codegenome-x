import { Analyzer, AnalysisContext } from '../types.js';

export class ReactAnalyzer implements Analyzer {
  name = 'ReactAnalyzer';
  supportedExtensions = ['.jsx', '.tsx'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Simple regex-based analysis for React components
    const componentRegex = /(?:function|const|class)\s+(\w+).*?(?:\(|=).*?\{[\s\S]*?return[\s\S]*?\}/g;
    const hookRegex = /(use[A-Z]\w*)\s*\(/g;
    const jsxRegex = /<([A-Z]\w*)/g;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    // Find React components
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      const startIndex = match.index;
      
      // Calculate line number
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 for newline
        if (charCount > startIndex) {
          lineNumber = i + 1;
          break;
        }
      }

      const loc = match[0].split('\n').length;
      const nodeId = `${filePath}:component:${componentName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'react_component',
        name: componentName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          componentType: this.detectComponentType(match[0]),
          hasHooks: this.hasHooks(match[0]),
          hasJSX: this.hasJSX(match[0]),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Find React hooks
    while ((match = hookRegex.exec(content)) !== null) {
      const hookName = match[1];
      const startIndex = match.index;
      
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount > startIndex) {
          lineNumber = i + 1;
          break;
        }
      }

      const nodeId = `${filePath}:hook:${hookName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'react_hook',
        name: hookName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          hookType: this.categorizeHook(hookName),
        },
        loc: 1,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private detectComponentType(content: string): string {
    if (content.includes('class ')) return 'class';
    if (content.includes('function ')) return 'function';
    if (content.includes('const ') && content.includes('=>')) return 'arrow';
    return 'unknown';
  }

  private hasHooks(content: string): boolean {
    return /use[A-Z]\w*\s*\(/.test(content);
  }

  private hasJSX(content: string): boolean {
    return /</.test(content);
  }

  private categorizeHook(hookName: string): string {
    const stateHooks = ['useState', 'useReducer'];
    const effectHooks = ['useEffect', 'useLayoutEffect'];
    const contextHooks = ['useContext'];
    const refHooks = ['useRef', 'useCallback', 'useMemo'];

    if (stateHooks.includes(hookName)) return 'state';
    if (effectHooks.includes(hookName)) return 'effect';
    if (contextHooks.includes(hookName)) return 'context';
    if (refHooks.includes(hookName)) return 'ref';
    return 'custom';
  }
}