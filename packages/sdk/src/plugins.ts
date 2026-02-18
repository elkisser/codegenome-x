import { BaseAnalyzer, PluginManager, AnalysisUtils } from './analyzer.js';

// Example custom analyzers

/**
 * Vue.js Single File Component Analyzer
 */
export class VueAnalyzer extends BaseAnalyzer {
  name = 'VueAnalyzer';
  supportedExtensions = ['.vue'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Simple regex-based analysis for Vue SFC
    const templateMatch = content.match(/<template>[\s\S]*?<\/template>/);
    const scriptMatch = content.match(/<script[\s\S]*?>[\s\S]*?<\/script>/);
    const styleMatch = content.match(/<style[\s\S]*?>[\s\S]*?<\/style>/);
    
    // Analyze template
    if (templateMatch) {
      this.analyzeTemplate(templateMatch[0], filePath, graph);
    }
    
    // Analyze script
    if (scriptMatch) {
      this.analyzeScript(scriptMatch[0], filePath, graph);
    }
    
    // Analyze styles
    if (styleMatch) {
      this.analyzeStyles(styleMatch[0], filePath, graph);
    }
  }

  private analyzeTemplate(template: string, filePath: string, graph: any): void {
    const componentRegex = /<([A-Z]\w+)/g;
    const directiveRegex = /v-\w+/g;
    const eventRegex = /@\w+/g;
    
    let match;
    let lineNumber = 0;
    const lines = template.split('\n');
    
    // Find child components
    while ((match = componentRegex.exec(template)) !== null) {
      const componentName = match[1];
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(template, startIndex);
      
      this.addNode(
        { filePath, content: template, graph } as any,
        'vue_component_usage',
        componentName,
        lineNumber,
        0,
        1,
        { componentType: 'child' }
      );
    }
    
    // Find directives
    while ((match = directiveRegex.exec(template)) !== null) {
      const directive = match[0];
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(template, startIndex);
      
      this.addNode(
        { filePath, content: template, graph } as any,
        'vue_directive',
        directive,
        lineNumber,
        0,
        1,
        { directiveType: directive }
      );
    }
  }

  private analyzeScript(script: string, filePath: string, graph: any): void {
    // Look for Vue-specific patterns
    const exportDefaultRegex = /export\s+default\s*\{[\s\S]*?\}/g;
    const propsRegex = /props\s*:\s*\{[\s\S]*?\}/g;
    const dataRegex = /data\s*\(\s*\)\s*\{[\s\S]*?\}/g;
    const methodsRegex = /methods\s*:\s*\{[\s\S]*?\}/g;
    const computedRegex = /computed\s*:\s*\{[\s\S]*?\}/g;
    const watchRegex = /watch\s*:\s*\{[\s\S]*?\}/g;
    
    let match;
    
    // Find export default
    if ((match = exportDefaultRegex.exec(script)) !== null) {
      const startIndex = match.index;
      const lineNumber = this.getLineNumber(script, startIndex);
      
      this.addNode(
        { filePath, content: script, graph } as any,
        'vue_export_default',
        'export default',
        lineNumber,
        0,
        this.calculateLOC(script, match.index, match.index + match[0].length),
        { hasProps: propsRegex.test(script) }
      );
    }
    
    // Find methods
    while ((match = methodsRegex.exec(script)) !== null) {
      const startIndex = match.index;
      const lineNumber = this.getLineNumber(script, startIndex);
      
      this.addNode(
        { filePath, content: script, graph } as any,
        'vue_methods',
        'methods',
        lineNumber,
        0,
        this.calculateLOC(script, match.index, match.index + match[0].length),
        { sectionType: 'methods' }
      );
    }
  }

  private analyzeStyles(style: string, filePath: string, graph: any): void {
    const scopedRegex = /scoped/g;
    const moduleRegex = /module/g;
    
    const isScoped = scopedRegex.test(style);
    const isModule = moduleRegex.test(style);
    
    this.addNode(
      { filePath, content: style, graph } as any,
      'vue_styles',
      'styles',
      1,
      0,
      style.split('\n').length,
      { scoped: isScoped, module: isModule }
    );
  }
}

/**
 * Python Analyzer
 */
export class PythonAnalyzer extends BaseAnalyzer {
  name = 'PythonAnalyzer';
  supportedExtensions = ['.py'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Simple regex-based analysis for Python
    const classRegex = /^class\s+(\w+)/gm;
    const functionRegex = /^def\s+(\w+)/gm;
    const importRegex = /^(?:from\s+(\w+)\s+)?import\s+(.+)$/gm;
    
    let match;
    
    // Find classes
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'python_class',
        className,
        lineNumber,
        0,
        this.getBlockLOC(content, match.index),
        { classType: 'standard' }
      );
    }
    
    // Find functions
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'python_function',
        functionName,
        lineNumber,
        0,
        this.getBlockLOC(content, match.index),
        { 
          functionType: 'standard',
          complexity: AnalysisUtils.calculateCyclomaticComplexity(
            AnalysisUtils.extractBlock(content, match.index) || ''
          )
        }
      );
    }
    
    // Find imports
    while ((match = importRegex.exec(content)) !== null) {
      const module = match[1] || match[2].split(',')[0].trim();
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'python_import',
        module,
        lineNumber,
        0,
        1,
        { importType: match[1] ? 'from' : 'direct' }
      );
    }
  }

  private getBlockLOC(content: string, startIndex: number): number {
    const block = AnalysisUtils.extractBlock(content, startIndex);
    return block ? block.split('\n').length : 1;
  }
}

/**
 * Java Analyzer
 */
export class JavaAnalyzer extends BaseAnalyzer {
  name = 'JavaAnalyzer';
  supportedExtensions = ['.java'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Simple regex-based analysis for Java
    const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?class\s+(\w+)/g;
    const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    const annotationRegex = /@(\w+)/g;
    
    let match;
    
    // Find classes
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'java_class',
        className,
        lineNumber,
        0,
        this.getBlockLOC(content, match.index),
        { classType: 'standard' }
      );
    }
    
    // Find methods
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'java_method',
        methodName,
        lineNumber,
        0,
        this.getBlockLOC(content, match.index),
        { 
          methodType: 'standard',
          complexity: AnalysisUtils.calculateCyclomaticComplexity(
            AnalysisUtils.extractBlock(content, match.index) || ''
          )
        }
      );
    }
    
    // Find annotations
    while ((match = annotationRegex.exec(content)) !== null) {
      const annotation = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      
      this.addNode(
        { filePath, content, graph } as any,
        'java_annotation',
        annotation,
        lineNumber,
        0,
        1,
        { annotationType: 'standard' }
      );
    }
  }

  private getBlockLOC(content: string, startIndex: number): number {
    const block = AnalysisUtils.extractBlock(content, startIndex);
    return block ? block.split('\n').length : 1;
  }
}

// Export everything
export {
  BaseAnalyzer,
  PluginManager,
  AnalysisUtils,
  VueAnalyzer,
  PythonAnalyzer,
  JavaAnalyzer,
};

export type { Analyzer, AnalysisContext } from '@codegenome-x/core';