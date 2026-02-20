import { Analyzer, AnalysisContext } from '../types.js';

export class SymfonyAnalyzer implements Analyzer {
  name = 'SymfonyAnalyzer';
  supportedExtensions = ['.php'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Analyze controllers
    this.analyzeControllers(content, filePath, graph);
    
    // Analyze services
    this.analyzeServices(content, filePath, graph);
    
    // Analyze routes
    this.analyzeRoutes(content, filePath, graph);
    
    // Analyze entities
    this.analyzeEntities(content, filePath, graph);
    
    // Analyze repositories
    this.analyzeRepositories(filePath, graph, content);
  }

  private analyzeControllers(content: string, filePath: string, graph: any): void {
    const controllerRegex = /class\s+(\w+).*?extends\s+(?:AbstractController|Controller)/g;
    const actionRegex = /public\s+function\s+(\w+)Action\s*\([^)]*\)/g;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    // Find controllers
    while ((match = controllerRegex.exec(content)) !== null) {
      const controllerName = match[1];
      if (!controllerName) continue;
      
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      const loc = this.getBlockLoc(content, startIndex);
      
      const nodeId = `${filePath}:controller:${controllerName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_controller',
        name: controllerName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          controllerType: 'standard',
          hasActions: this.hasActions(content),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Find actions
    while ((match = actionRegex.exec(content)) !== null) {
      const actionName = match[1];
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      const loc = this.getBlockLoc(content, startIndex);
      
      const nodeId = `${filePath}:action:${actionName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_action',
        name: actionName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          actionType: 'standard',
          hasRoute: this.hasRouteAnnotation(content, startIndex),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private analyzeServices(content: string, filePath: string, graph: any): void {
    const serviceRegex = /class\s+(\w+).*?implements?\s+(\w*Service\w*)/g;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = serviceRegex.exec(content)) !== null) {
      const serviceName = match[1];
      if (!serviceName) continue;
      
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      const loc = this.getBlockLoc(content, startIndex);
      
      const nodeId = `${filePath}:service:${serviceName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_service',
        name: serviceName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          serviceType: match[2] || 'custom',
          hasTag: this.hasServiceTag(content),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private analyzeRoutes(content: string, filePath: string, graph: any): void {
    const routeRegex = /@Route\s*\(\s*"([^"]+)".*?name="([^"]+)"/g;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = routeRegex.exec(content)) !== null) {
      const routePath = match[1];
      const routeName = match[2];
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      const nodeId = `${filePath}:route:${routeName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_route',
        name: routeName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          path: routePath,
          method: this.getRouteMethod(content, startIndex),
        },
        loc: 1,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private analyzeEntities(content: string, filePath: string, graph: any): void {
    const entityRegex = /@Entity\(\).*?class\s+(\w+)/gs;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = entityRegex.exec(content)) !== null) {
      const entityName = match[1];
      if (!entityName) continue;
      
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      const loc = this.getBlockLoc(content, startIndex);
      
      const nodeId = `${filePath}:entity:${entityName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_entity',
        name: entityName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          entityType: 'doctrine',
          hasRepository: this.hasRepository(content, entityName),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private analyzeRepositories(filePath: string, graph: any, content: string): void {
    const repositoryRegex = /class\s+(\w+).*?extends\s+ServiceEntityRepository/g;

    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = repositoryRegex.exec(content)) !== null) {
      const repositoryName = match[1];
      if (!repositoryName) continue;
      
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      const loc = this.getBlockLoc(content, startIndex);
      
      const nodeId = `${filePath}:repository:${repositoryName}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'symfony_repository',
        name: repositoryName,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          repositoryType: 'doctrine',
          entity: this.getRepositoryEntity(content, repositoryName),
        },
        loc,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private getLineNumber(lines: string[], startIndex: number): number {
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined) {
        charCount += line.length + 1;
        if (charCount > startIndex) {
          return i + 1;
        }
      }
    }
    return 1;
  }

  private getBlockLoc(content: string, startIndex: number): number {
    let braceCount = 0;
    let inBlock = false;
    let loc = 0;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inBlock = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          const blockContent = content.substring(startIndex, i + 1);
          loc = blockContent.split('\n').length;
          break;
        }
      }
    }
    
    return loc || 1;
  }

  private hasActions(content: string): boolean {
    return new RegExp(`public function \w+Action`).test(content);
  }

  private hasRouteAnnotation(content: string, startIndex: number): boolean {
    const beforeContent = content.substring(Math.max(0, startIndex - 100), startIndex);
    return /@Route/.test(beforeContent);
  }

  private hasServiceTag(content: string): boolean {
    return /tags:\s*\[/.test(content);
  }

  private getRouteMethod(content: string, startIndex: number): string {
    const beforeContent = content.substring(Math.max(0, startIndex - 200), startIndex);
    const methodMatch = beforeContent.match(/methods\s*=\s*\[\s*["'](\w+)["']\s*\]/);
    return methodMatch && methodMatch[1] ? methodMatch[1] : 'GET';
  }

  private hasRepository(content: string, entityName: string): boolean {
    return new RegExp(`@ORM\\\\Entity\(.*?repositoryClass.*?${entityName}Repository`, 's').test(content);
  }

  private getRepositoryEntity(content: string, repositoryName: string): string {
    const match = content.match(new RegExp(`class\s+${repositoryName}.*?@ORM\\Entity\(.*?class\s+(\w+)`, 's'));
    return match && match[1] ? match[1] : 'Unknown';
  }
}