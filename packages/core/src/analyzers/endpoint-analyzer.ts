import { Analyzer, AnalysisContext } from '../types.js';

export class EndpointAnalyzer implements Analyzer {
  name = 'EndpointAnalyzer';
  supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.php'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Analyze different types of endpoints based on file extension
    if (filePath.endsWith('.php')) {
      this.analyzeSymfonyEndpoints(content, filePath, graph);
    } else {
      this.analyzeJavaScriptEndpoints(content, filePath, graph);
    }
  }

  private analyzeJavaScriptEndpoints(content: string, filePath: string, graph: any): void {
    // Express.js endpoints
    const expressRegex = /(app|router)\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    // Next.js API routes
    const nextApiRegex = /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+).*?\(req:\s*NextApiRequest.*?res:\s*NextApiResponse/g;
    
    // Fetch API calls
    const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    // Axios calls
    const axiosRegex = /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    this.processEndpoints(content, filePath, graph, expressRegex, 'express');
    this.processEndpoints(content, filePath, graph, nextApiRegex, 'nextjs');
    this.processClientCalls(content, filePath, graph, fetchRegex, 'fetch');
    this.processClientCalls(content, filePath, graph, axiosRegex, 'axios');
  }

  private analyzeSymfonyEndpoints(content: string, filePath: string, graph: any): void {
    // Symfony route annotations
    const routeAnnotationRegex = /@Route\s*\(\s*"([^"]+)".*?methods\s*=\s*\{([^}]+)\}/g;
    
    // Symfony route attributes (PHP 8+)
    const routeAttributeRegex = /\#\[Route\s*\(\s*"([^"]+)".*?methods\s*:\s*\[([^\]]+)\]/g;
    
    // API Platform endpoints
    const apiPlatformRegex = /@ApiResource\s*\([^)]*\)/g;

    this.processSymfonyEndpoints(content, filePath, graph, routeAnnotationRegex, 'annotation');
    this.processSymfonyEndpoints(content, filePath, graph, routeAttributeRegex, 'attribute');
    this.processApiPlatformEndpoints(content, filePath, graph, apiPlatformRegex);
  }

  private processEndpoints(content: string, filePath: string, graph: any, regex: RegExp, type: string): void {
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const path = match[3] || match[1] || 'unknown';
      const method = match[2] || 'GET';
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      const nodeId = `${filePath}:endpoint:${type}:${method}:${path}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'endpoint',
        name: `${method.toUpperCase()} ${path}`,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          endpointType: type,
          method: method.toUpperCase(),
          path,
          isPublic: this.isPublicEndpoint(path),
          isProtected: this.isProtectedEndpoint(content, startIndex),
        },
        loc: 1,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private processClientCalls(content: string, filePath: string, graph: any, regex: RegExp, type: string): void {
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const url = match[1] || match[2];
      const method = match[1] ? match[1] : 'GET';
      if (!url) continue;
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      const nodeId = `${filePath}:client_call:${type}:${method}:${url}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'client_call',
        name: `${method.toUpperCase()} ${url}`,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          clientType: type,
          method: method.toUpperCase(),
          url,
          isExternal: this.isExternalUrl(url),
        },
        loc: 1,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  private processSymfonyEndpoints(content: string, filePath: string, graph: any, regex: RegExp, type: string): void {
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const path = match[1];
      if (!path) continue;
      const methods = match[2] ? match[2].replace(/['"\s]/g, '').split(',') : ['GET'];
      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      methods.forEach(method => {
        const nodeId = `${filePath}:endpoint:symfony:${type}:${method}:${path}:${lineNumber}`;
        
        graph.addNode({
          id: nodeId,
          type: 'endpoint',
          name: `${method.toUpperCase()} ${path}`,
          filePath,
          line: lineNumber,
          column: 0,
          metadata: {
            endpointType: 'symfony',
            routeType: type,
            method: method.toUpperCase(),
            path,
            isPublic: this.isPublicEndpoint(path),
            isProtected: this.isProtectedEndpoint(content, startIndex),
          },
          loc: 1,
          dependencies: new Set(),
          dependents: new Set(),
        });
      });
    }
  }

  private processApiPlatformEndpoints(content: string, filePath: string, graph: any, regex: RegExp): void {
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const startIndex = match.index;
      if (startIndex === undefined) continue;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      const nodeId = `${filePath}:endpoint:api_platform:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'endpoint',
        name: 'API Platform Resource',
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          endpointType: 'api_platform',
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          isPublic: true,
          isProtected: false,
        },
        loc: 1,
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

  private isPublicEndpoint(path: string): boolean {
    const publicPatterns = [
      /^\/api\/public/,
      /^\/health/,
      /^\/status/,
      /^\/login/,
      /^\/register/,
    ];
    
    return publicPatterns.some(pattern => pattern.test(path));
  }

  private isProtectedEndpoint(content: string, startIndex: number): boolean {
    const beforeContent = content.substring(Math.max(0, startIndex - 500), startIndex);
    const protectedPatterns = [
      /auth/,
      /protected/,
      /guard/,
      /middleware/,
      /@Security/,
      /@IsGranted/,
    ];
    
    return protectedPatterns.some(pattern => pattern.test(beforeContent));
  }

  private isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }
}