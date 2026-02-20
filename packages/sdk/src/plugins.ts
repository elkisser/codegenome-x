import { BaseAnalyzer } from './analyzer';

/**
 * Collection of official analyzers for common frameworks
 */

/**
 * Vue.js Single File Component Analyzer
 */
export class VueAnalyzer extends BaseAnalyzer {
  name = 'VueAnalyzer';
  supportedExtensions = ['.vue'];

  async analyze(context: any): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Simple regex-based analysis for Vue SFC
    const templateMatch = content.match(/<template>[\s\S]*?<\/template>/);
    const scriptMatch = content.match(/<script[\s\S]*?>[\s\S]*?<\/script>/);
    
    // Analyze template
    if (templateMatch) {
      this.analyzeVueTemplate(templateMatch[0], filePath, graph);
    }
    
    // Analyze script
    if (scriptMatch) {
      this.analyzeVueScript(scriptMatch[0], filePath, graph);
    }
  }

  private analyzeVueTemplate(template: string, filePath: string, graph: any): void {
    const componentRegex = /<([A-Z]\w+)/g;
    let match;
    
    while ((match = componentRegex.exec(template)) !== null) {
      const componentName = match[1];
      // Create edge to component
      graph.addEdge(filePath, componentName, 'uses_component');
    }
  }

  private analyzeVueScript(script: string, filePath: string, graph: any): void {
    const importRegex = /import\s+[\w{},\s]*\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(script)) !== null) {
      const modulePath = match[1];
      if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
        graph.addEdge(filePath, modulePath, 'imports');
      }
    }
  }
}

/**
 * Python Project Analyzer
 */
export class PythonAnalyzer extends BaseAnalyzer {
  name = 'PythonAnalyzer';
  supportedExtensions = ['.py'];

  async analyze(context: any): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Analyze Python imports
    this.analyzePythonImports(content, filePath, graph);
    
    // Analyze class definitions
    this.analyzePythonClasses(content, filePath, graph);
  }

  private analyzePythonImports(content: string, filePath: string, graph: any): void {
    const importRegex = /^(?:from|import)\s+([a-zA-Z0-9_.]+)/gm;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const moduleName = match[1];
      if (moduleName && moduleName.trim()) {
        graph.addEdge(filePath, moduleName, 'imports');
      }
    }
  }

  private analyzePythonClasses(content: string, filePath: string, graph: any): void {
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/gm;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const baseClasses = match[2];
      
      if (baseClasses) {
        const bases = baseClasses.split(',').map((b: string) => b.trim());
        bases.forEach((base: string) => {
          if (base) {
            graph.addEdge(filePath, base, 'extends');
          }
        });
      }
    }
  }
}

/**
 * Java Project Analyzer
 */
export class JavaAnalyzer extends BaseAnalyzer {
  name = 'JavaAnalyzer';
  supportedExtensions = ['.java'];

  async analyze(context: any): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Analyze Java imports
    this.analyzeJavaImports(content, filePath, graph);
    
    // Analyze class definitions and inheritance
    this.analyzeJavaClasses(content, filePath, graph);
    
    // Analyze annotations
    this.analyzeJavaAnnotations(content, filePath, graph);
  }

  private analyzeJavaImports(content: string, filePath: string, graph: any): void {
    const importRegex = /^import\s+([a-zA-Z0-9.*_]+);/gm;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath && importPath.trim()) {
        graph.addEdge(filePath, importPath, 'imports');
      }
    }
  }

  private analyzeJavaClasses(content: string, filePath: string, graph: any): void {
    const classRegex = /^(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/gm;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      
      if (extendsClass) {
        graph.addEdge(filePath, extendsClass, 'extends');
      }
      
      graph.addEdge(filePath, className, 'defines');
    }
  }

  private analyzeJavaAnnotations(content: string, filePath: string, graph: any): void {
    const annotationRegex = /@(\w+)/g;
    let match;
    const seenAnnotations = new Set<string>();
    
    while ((match = annotationRegex.exec(content)) !== null) {
      const annotation = match[1];
      if (!seenAnnotations.has(annotation)) {
        graph.addEdge(filePath, annotation, 'uses_annotation');
        seenAnnotations.add(annotation);
      }
    }
  }
}

/**
 * Export all official analyzers
 */
export {
  VueAnalyzer,
  PythonAnalyzer,
  JavaAnalyzer,
};

export default {
  VueAnalyzer,
  PythonAnalyzer,
  JavaAnalyzer,
};