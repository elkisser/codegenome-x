import { BaseAnalyzer, AnalysisContext } from '@codegenome-x/sdk';

/**
 * Example: Custom Angular Component Analyzer
 * 
 * This analyzer demonstrates how to create a custom analyzer
 * for Angular components, including:
 * - Component metadata detection
   - Input/Output property analysis
 * - Template dependency tracking
 * - Service injection analysis
 */

export class AngularAnalyzer extends BaseAnalyzer {
  name = 'AngularAnalyzer';
  supportedExtensions = ['.component.ts', '.service.ts', '.module.ts'];

  async analyze(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Determine file type and analyze accordingly
    if (filePath.endsWith('.component.ts')) {
      await this.analyzeComponent(context);
    } else if (filePath.endsWith('.service.ts')) {
      await this.analyzeService(context);
    } else if (filePath.endsWith('.module.ts')) {
      await this.analyzeModule(context);
    }
  }

  private async analyzeComponent(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Find @Component decorator
    const componentRegex = /@Component\s*\(([\s\S]*?)\)\s*export\s+class\s+(\w+)/;
    const componentMatch = content.match(componentRegex);
    
    if (componentMatch) {
      const componentName = componentMatch[2];
      const decoratorContent = componentMatch[1];
      
      // Add component node
      const componentId = this.addNode(
        context,
        'angular_component',
        componentName,
        this.getLineNumber(content, componentMatch.index),
        0,
        this.calculateLOC(content, componentMatch.index, componentMatch.index + componentMatch[0].length),
        {
          selector: this.extractSelector(decoratorContent),
          templateUrl: this.extractTemplateUrl(decoratorContent),
          styleUrls: this.extractStyleUrls(decoratorContent),
        }
      );
      
      // Find @Input properties
      const inputRegex = /@Input\(\)\s+(\w+):\s*([^;]+);/g;
      let inputMatch;
      while ((inputMatch = inputRegex.exec(content)) !== null) {
        const inputId = this.addNode(
          context,
          'angular_input',
          inputMatch[1],
          this.getLineNumber(content, inputMatch.index),
          0,
          1,
          { type: inputMatch[2] }
        );
        this.addEdge(context, componentId, inputId, 'has_input');
      }
      
      // Find @Output properties
      const outputRegex = /@Output\(\)\s+(\w+)\s*=\s*new\s+EventEmitter/g;
      let outputMatch;
      while ((outputMatch = outputRegex.exec(content)) !== null) {
        const outputId = this.addNode(
          context,
          'angular_output',
          outputMatch[1],
          this.getLineNumber(content, outputMatch.index),
          0,
          1,
          { type: 'EventEmitter' }
        );
        this.addEdge(context, componentId, outputId, 'has_output');
      }
      
      // Find constructor dependencies
      await this.analyzeConstructorDependencies(context, componentId);
    }
  }

  private async analyzeService(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Find @Injectable decorator
    const serviceRegex = /@Injectable\s*\(([\s\S]*?)\)\s*export\s+class\s+(\w+)/;
    const serviceMatch = content.match(serviceRegex);
    
    if (serviceMatch) {
      const serviceName = serviceMatch[2];
      
      // Add service node
      const serviceId = this.addNode(
        context,
        'angular_service',
        serviceName,
        this.getLineNumber(content, serviceMatch.index),
        0,
        this.calculateLOC(content, serviceMatch.index, serviceMatch.index + serviceMatch[0].length),
        {
          providedIn: this.extractProvidedIn(serviceMatch[1]),
        }
      );
      
      // Find methods
      const methodRegex = /(\w+)\s*\([^)]*\)\s*:\s*(\w+)/g;
      let methodMatch;
      while ((methodMatch = methodRegex.exec(content)) !== null) {
        const methodId = this.addNode(
          context,
          'angular_service_method',
          methodMatch[1],
          this.getLineNumber(content, methodMatch.index),
          0,
          1,
          { returnType: methodMatch[2] }
        );
        this.addEdge(context, serviceId, methodId, 'has_method');
      }
    }
  }

  private async analyzeModule(context: AnalysisContext): Promise<void> {
    const { filePath, content, graph } = context;
    
    // Find @NgModule decorator
    const moduleRegex = /@NgModule\s*\(([\s\S]*?)\)\s*export\s+class\s+(\w+)/;
    const moduleMatch = content.match(moduleRegex);
    
    if (moduleMatch) {
      const moduleName = moduleMatch[2];
      const decoratorContent = moduleMatch[1];
      
      // Add module node
      const moduleId = this.addNode(
        context,
        'angular_module',
        moduleName,
        this.getLineNumber(content, moduleMatch.index),
        0,
        this.calculateLOC(content, moduleMatch.index, moduleMatch.index + moduleMatch[0].length),
        {
          declarations: this.extractArray(decoratorContent, 'declarations'),
          imports: this.extractArray(decoratorContent, 'imports'),
          exports: this.extractArray(decoratorContent, 'exports'),
          providers: this.extractArray(decoratorContent, 'providers'),
        }
      );
    }
  }

  private async analyzeConstructorDependencies(context: AnalysisContext, componentId: string): Promise<void> {
    const { content, graph } = context;
    
    // Find constructor with dependency injection
    const constructorRegex = /constructor\s*\(([^)]*)\)/;
    const constructorMatch = content.match(constructorRegex);
    
    if (constructorMatch) {
      const params = constructorMatch[1];
      const paramRegex = /(\w+):\s*(\w+)/g;
      let paramMatch;
      
      while ((paramMatch = paramRegex.exec(params)) !== null) {
        const serviceName = paramMatch[2];
        const paramId = this.addNode(
          context,
          'angular_injected_service',
          serviceName,
          this.getLineNumber(content, paramMatch.index),
          0,
          1,
          { parameterName: paramMatch[1] }
        );
        this.addEdge(context, componentId, paramId, 'injects_service');
      }
    }
  }

  // Helper methods
  private extractSelector(decoratorContent: string): string {
    const selectorRegex = /selector\s*:\s*['"`]([^'"`]+)['"`]/;
    const match = decoratorContent.match(selectorRegex);
    return match ? match[1] : '';
  }

  private extractTemplateUrl(decoratorContent: string): string {
    const templateUrlRegex = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/;
    const match = decoratorContent.match(templateUrlRegex);
    return match ? match[1] : '';
  }

  private extractStyleUrls(decoratorContent: string): string[] {
    const styleUrlsRegex = /styleUrls\s*:\s*\[([^\]]+)\]/;
    const match = decoratorContent.match(styleUrlsRegex);
    if (match) {
      return match[1].split(',').map(url => url.trim().replace(/['"`]/g, ''));
    }
    return [];
  }

  private extractProvidedIn(decoratorContent: string): string {
    const providedInRegex = /providedIn\s*:\s*['"`]([^'"`]+)['"`]/;
    const match = decoratorContent.match(providedInRegex);
    return match ? match[1] : 'root';
  }

  private extractArray(content: string, propertyName: string): string[] {
    const regex = new RegExp(`${propertyName}\\s*:\\s*\\[([^\\]]+)\\]`);
    const match = content.match(regex);
    if (match) {
      return match[1].split(',').map(item => item.trim().replace(/['"`]/g, ''));
    }
    return [];
  }
}

// Usage example
export function registerAngularAnalyzer(pluginManager: PluginManager): void {
  pluginManager.registerAnalyzer(new AngularAnalyzer());
}