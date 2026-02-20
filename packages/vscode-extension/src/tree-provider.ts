import * as vscode from 'vscode';
import { Graph, GraphNode, ImpactScore } from '@codegenome-x/core';

export class CodeGenomeProvider implements vscode.TreeDataProvider<CodeGenomeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CodeGenomeItem | undefined | null> = new vscode.EventEmitter<CodeGenomeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<CodeGenomeItem | undefined | null> = this._onDidChangeTreeData.event;
    
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
            if (!node) {
                return Promise.resolve([]);
            }
            const children: CodeGenomeItem[] = [];
            
            // Add dependencies
            const dependencies = Array.from(this.graph.getDependencies(node.id));
            if (dependencies.length > 0) {
                children.push(new CodeGenomeItem(
                    'Dependencies',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'dependencies',
                    undefined,
                    undefined,
                    dependencies.map((dep: string) => new CodeGenomeItem(
                        dep,
                        vscode.TreeItemCollapsibleState.None,
                        'node',
                        undefined,
                        undefined,
                        'link' as any
                    ))
                ));
            }
            
            // Add dependents
            const dependents = Array.from(this.graph.getDependents(node.id));
            if (dependents.length > 0) {
                children.push(new CodeGenomeItem(
                    'Dependents',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'dependents',
                    undefined,
                    undefined,
                    dependents.map((dep: string) => new CodeGenomeItem(
                        dep,
                        vscode.TreeItemCollapsibleState.None,
                        'node',
                        undefined,
                        undefined,
                        'link' as any
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
        
        return sortedCategories.map(({ type, nodes, avgImpact }) => {
            const sortedNodesList = nodes
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
                'symbol-namespace' as any,
                sortedNodesList
            );
        });
    }
    
    private getImpactIcon(impact: ImpactScore): any {
        switch (impact.level) {
            case 'Critical':
                return 'circle-filled';
            case 'High':
                return 'warning';
            case 'Medium':
                return 'info';
            case 'Low':
                return 'check';
            default:
                return 'symbol-variable';
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