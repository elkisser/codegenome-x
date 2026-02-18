import * as vscode from 'vscode';
import { Graph, GraphNode, ImpactScore } from '@codegenome-x/core';

export class CodeGenomeProvider implements vscode.TreeDataProvider<CodeGenomeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CodeGenomeItem | undefined | null | void> = new vscode.EventEmitter<CodeGenomeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CodeGenomeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private graph: Graph | undefined;
    private items: CodeGenomeItem[] = [];
    
    constructor() {}
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    updateData(graph: Graph): void {
        this.graph = graph;
        this.items = this.buildItems(graph);
        this.refresh();
    }
    
    getTreeItem(element: CodeGenomeItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: CodeGenomeItem): Thenable<CodeGenomeItem[]> {
        if (!this.graph) {
            return Promise.resolve([]);
        }
        
        if (!element) {
            return Promise.resolve(this.items);
        }
        
        if (element.type === 'category') {
            return Promise.resolve(element.children || []);
        }
        
        if (element.type === 'node') {
            const node = element.node;
            const children: CodeGenomeItem[] = [];
            
            // Add dependencies
            const dependencies = this.graph.getDependencies(node.id);
            if (dependencies.length > 0) {
                children.push(new CodeGenomeItem(
                    'Dependencies',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'dependencies',
                    undefined,
                    dependencies.map(dep => new CodeGenomeItem(
                        dep.name,
                        vscode.TreeItemCollapsibleState.None,
                        'node',
                        dep,
                        undefined,
                        new vscode.ThemeIcon('link')
                    ))
                ));
            }
            
            // Add dependents
            const dependents = this.graph.getDependents(node.id);
            if (dependents.length > 0) {
                children.push(new CodeGenomeItem(
                    'Dependents',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'dependents',
                    undefined,
                    dependents.map(dep => new CodeGenomeItem(
                        dep.name,
                        vscode.TreeItemCollapsibleState.None,
                        'node',
                        dep,
                        undefined,
                        new vscode.ThemeIcon('link')
                    ))
                ));
            }
            
            return Promise.resolve(children);
        }
        
        return Promise.resolve([]);
    }
    
    private buildItems(graph: Graph): CodeGenomeItem[] {
        const nodes = graph.getAllNodes();
        const categories = new Map<string, GraphNode[]>();
        
        // Group nodes by type
        nodes.forEach(node => {
            if (!categories.has(node.type)) {
                categories.set(node.type, []);
            }
            categories.get(node.type)!.push(node);
        });
        
        // Sort categories by impact
        const sortedCategories = Array.from(categories.entries())
            .map(([type, nodes]) => {
                const avgImpact = nodes.reduce((sum, node) => {
                    const impact = graph.removeNodeSimulation(node.id).impactScore;
                    return sum + impact.score;
                }, 0) / nodes.length;
                
                return { type, nodes, avgImpact };
            })
            .sort((a, b) => b.avgImpact - a.avgImpact);
        
        return sortedCategories.map(({ type, nodes }) => {
            const children = nodes
                .sort((a, b) => {
                    const impactA = graph.removeNodeSimulation(a.id).impactScore;
                    const impactB = graph.removeNodeSimulation(b.id).impactScore;
                    return impactB.score - impactA.score;
                })
                .map(node => {
                    const impact = graph.removeNodeSimulation(node.id).impactScore;
                    const icon = this.getImpactIcon(impact);
                    const tooltip = `Impact Score: ${impact.score.toFixed(2)} (${impact.level})\nFile: ${node.filePath}:${node.line}`;
                    
                    return new CodeGenomeItem(
                        node.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'node',
                        node,
                        tooltip,
                        icon
                    );
                });
            
            return new CodeGenomeItem(
                `${type} (${nodes.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'category',
                undefined,
                `Average Impact: ${avgImpact.toFixed(2)}`,
                new vscode.ThemeIcon('symbol-namespace')
            );
        });
    }
    
    private getImpactIcon(impact: ImpactScore): vscode.ThemeIcon {
        switch (impact.level) {
            case 'Critical':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            case 'High':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
            case 'Medium':
                return new vscode.ThemeIcon('info', new vscode.ThemeColor('problemsInfoIcon.foreground'));
            case 'Low':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            default:
                return new vscode.ThemeIcon('symbol-variable');
        }
    }
}

export class CodeGenomeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'category' | 'node' | 'dependencies' | 'dependents',
        public readonly node?: GraphNode,
        public readonly tooltip?: string,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly children?: CodeGenomeItem[]
    ) {
        super(label, collapsibleState);
        
        this.tooltip = tooltip;
        this.iconPath = iconPath;
        
        if (type === 'node' && node) {
            this.command = {
                command: 'codegenome.exploreNode',
                title: 'Explore Node',
                arguments: [node.id]
            };
            this.contextValue = 'node';
        }
    }
}