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
      this.analyzeNestJsEndpoints(content, filePath, graph);
    }
  }

  private analyzeNestJsEndpoints(content: string, filePath: string, graph: any): void {
    // NestJS decorators: @Get('path'), @Post('path'), etc.
    const nestRegex = /@(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;
    
    // Attempt to find Controller path prefix
    const controllerMatch = /@Controller\s*\(\s*(?:['"]([^'"]*)['"])?\s*\)/.exec(content);
    const controllerPath = controllerMatch ? (controllerMatch[1] || '/') : '';

    // Check if the controller itself is protected (has @UseGuards, @Auth, @ApiBearerAuth)
    const isControllerProtected = this.isControllerProtected(content);

    this.processEndpoints(content, filePath, graph, nestRegex, 'nestjs', controllerPath, isControllerProtected);
  }

  private isControllerProtected(content: string): boolean {
    const controllerRegex = /@Controller/;
    const match = controllerRegex.exec(content);
    if (!match) return false;
    
    // Check decorators above the class but after imports
    // Simplified: check if "UseGuards" or "Auth" appears before "class " but after imports
    const classIndex = content.indexOf('class ');
    if (classIndex === -1) return false;

    const preClassContent = content.substring(0, classIndex);
    // Find the last import
    const lastImportIndex = preClassContent.lastIndexOf('import ');
    const decoratorsSection = preClassContent.substring(lastImportIndex === -1 ? 0 : lastImportIndex);

    return /@(UseGuards|Auth|ApiBearerAuth|Roles)/.test(decoratorsSection);
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

  private processEndpoints(content: string, filePath: string, graph: any, regex: RegExp, type: string, prefix: string = '', inheritProtection: boolean = false): void {
    let match;
    let lineNumber = 0;
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      let path = match[3] || match[2] || '/'; // Group 3 for Express/Nest (path), Group 2 for Nest method or path
      
      // Fix for NestJS regex structure: 
      // Group 1: Method (Get, Post)
      // Group 2: Path (optional)
      if (type === 'nestjs') {
          path = match[2] || '/';
      }

      const method = (type === 'nestjs' ? match[1] : (match[2] || 'GET')).toUpperCase();
      
      // Combine with prefix if valid
      const fullPath = prefix ? `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : path;

      const startIndex = match.index;
      
      lineNumber = this.getLineNumber(lines, startIndex);
      
      // Check for method-level public decorator (overrides class protection)
      const isPublicOverride = this.isPublicEndpoint(fullPath) || /@Public/.test(content.substring(Math.max(0, startIndex - 200), startIndex));

      // Fix: If inheritProtection is true, it means the CLASS has @UseGuards.
      // So the method is protected UNLESS explicitly marked public.
      // If inheritProtection is false, we check the method for @UseGuards.
      const hasMethodProtection = this.isProtectedEndpoint(content, startIndex);
      const isProtected = (inheritProtection || hasMethodProtection) && !isPublicOverride;
      
      const nodeId = `${filePath}:endpoint:${type}:${method}:${fullPath}:${lineNumber}`;
      
      graph.addNode({
        id: nodeId,
        type: 'endpoint',
        name: `${method} ${fullPath}`,
        filePath,
        line: lineNumber,
        column: 0,
        metadata: {
          endpointType: type,
          method: method,
          path: fullPath,
          isPublic: isPublicOverride,
          isProtected: isProtected,
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