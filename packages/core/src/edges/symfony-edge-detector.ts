export interface Edge {
  source: string;
  target: string;
  type: 
    | 'injects'
    | 'exposes'
    | 'depends_on'
    | 'uses_entity'
    | 'route_to_controller'
    | 'repository_entity';
  metadata?: Record<string, any>;
}

export class SymfonyEdgeDetector {
  private edges: Edge[] = [];

  constructor(_projectRoot?: string, _debug?: boolean) {}

  detect(filePath: string, content: string): Edge[] {
    this.edges = [];

    // Detect service injections
    this.detectInjections(filePath, content);

    // Detect entity repositories
    this.detectRepositoryEntities(filePath, content);

    // Detect service dependencies
    this.detectServiceDependencies(filePath, content);

    // Detect attributes (PHP 8+)
    this.detectAttributes(filePath, content);

    return this.edges;
  }

  private detectInjections(filePath: string, content: string): void {
    // Pattern: #[Autowire] or @Inject
    const autowirePattern = /#\[Autowire\s*\(\s*service:\s*['"]([^'"]+)['"]\s*\)\]/g;
    let match;

    while ((match = autowirePattern.exec(content)) !== null) {
      if (!match[1]) continue;
      const serviceName = match[1];
      const className = this.extractClassName(filePath);

      if (className && serviceName) {
        this.edges.push({
          source: className,
          target: serviceName,
          type: 'injects',
          metadata: {
            line: this.getLineNumber(content, match.index || 0),
            attribute: 'Autowire',
          },
        });
      }
    }

    // Pattern: constructor injection
    const constructorPattern = /function\s+__construct\s*\(([\s\S]*?)\)/;
    const constructorMatch = constructorPattern.exec(content);

    if (constructorMatch && constructorMatch[1]) {
      const params = constructorMatch[1];
      const paramPattern = /(\w+)\s+\$\w+/g;
      let paramMatch;
      const className = this.extractClassName(filePath);

      while ((paramMatch = paramPattern.exec(params)) !== null) {
        if (!paramMatch[1]) continue;
        const paramType = paramMatch[1];

        if (className && !this.isBuiltInType(paramType)) {
          this.edges.push({
            source: className,
            target: paramType,
            type: 'injects',
            metadata: {
              line: this.getLineNumber(content, constructorMatch.index || 0),
              method: '__construct',
            },
          });
        }
      }
    }
  }

  private detectRepositoryEntities(filePath: string, content: string): void {
    // Pattern: class UserRepository extends ServiceEntityRepository
    const repositoryPattern = /class\s+(\w+Repository)\s+extends\s+ServiceEntityRepository/;
    const repositoryMatch = repositoryPattern.exec(content);

    if (repositoryMatch) {
      const repositoryName = repositoryMatch[1];

      // Find the Entity class in method
      const entityPattern = /ServiceEntityRepository\s*\(\s*(\w+)\s*\)/;
      const entityMatch = entityPattern.exec(content);

      if (entityMatch && entityMatch[1]) {
        const entityName = entityMatch[1];

        this.edges.push({
          source: repositoryName || 'Unknown',
          target: entityName,
          type: 'repository_entity',
          metadata: {
            line: this.getLineNumber(content, repositoryMatch.index || 0),
          },
        });
      }
    }

    // Alternative pattern for PHP attributes
    const attributeEntityPattern = /#\[ORM\\Entity\s*\(\s*repositoryClass:\s*([^)]+)\s*\)\]/;
    const attrMatch = attributeEntityPattern.exec(content);

    if (attrMatch && attrMatch[1]) {
      const repositoryClass = attrMatch[1].trim();
      const entityName = this.extractClassName(filePath);

      if (entityName) {
        this.edges.push({
          source: repositoryClass,
          target: entityName,
          type: 'repository_entity',
          metadata: {
            line: this.getLineNumber(content, attrMatch.index || 0),
            attribute: 'ORM\\Entity',
          },
        });
      }
    }
  }

  private detectServiceDependencies(filePath: string, content: string): void {
    // Pattern: service definitions in PHP attributes
    const servicePattern = /#\[AsController\]|#\[AsService\]|#\[AsEventListener\]/g;
    let match;
    const className = this.extractClassName(filePath);

    while ((match = servicePattern.exec(content)) !== null) {
      if (className && match[0]) {
        this.edges.push({
          source: className,
          target: 'symfony_service',
          type: 'exposes',
          metadata: {
            line: this.getLineNumber(content, match.index || 0),
            attribute: match[0],
          },
        });
      }
    }
  }

  private detectAttributes(filePath: string, content: string): void {
    // Pattern: Route attributes
    const routePattern = /#\[Route\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    const className = this.extractClassName(filePath);

    while ((match = routePattern.exec(content)) !== null) {
      if (!match[1]) continue;
      const routePath = match[1];

      if (className) {
        this.edges.push({
          source: routePath,
          target: className,
          type: 'route_to_controller',
          metadata: {
            line: this.getLineNumber(content, match.index || 0),
            path: routePath,
          },
        });
      }
    }

    // Pattern: ORM\Entity attributes
    const entityPattern = /#\[ORM\\Entity/g;
    while ((match = entityPattern.exec(content)) !== null) {
      if (className) {
        this.edges.push({
          source: className,
          target: 'doctrine_entity',
          type: 'exposes',
          metadata: {
            line: this.getLineNumber(content, match.index || 0),
            attribute: 'ORM\\Entity',
          },
        });
      }
    }

    // Pattern: Column attributes
    const columnPattern = /#\[ORM\\Column/g;
    let columnCount = 0;
    while ((match = columnPattern.exec(content)) !== null) {
      columnCount++;
    }

    if (columnCount > 0 && className) {
      this.edges.push({
        source: className,
        target: 'doctrine_columns',
        type: 'uses_entity',
        metadata: {
          count: columnCount,
        },
      });
    }
  }

  private extractClassName(filePath: string): string {
    // Extract classname from file path
    // E.g., /src/Controller/UserController.php -> UserController
    const basename = filePath.split('/').pop();
    if (!basename) return 'Unknown';
    return basename.replace(/\.php$/, '').replace(/\.ts$/, '').replace(/\.js$/, '');
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private isBuiltInType(type: string): boolean {
    const builtIns = [
      'string',
      'int',
      'bool',
      'float',
      'array',
      'object',
      'null',
      'void',
      'mixed',
      'Stringable',
      'Iterator',
      'Countable',
      'ArrayAccess',
    ];
    return builtIns.includes(type);
  }
}
