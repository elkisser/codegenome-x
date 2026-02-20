import * as vscode from 'vscode';
import { Graph, RemovalSimulation } from '@codegenome-x/core';

export class WebviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    
    constructor(_context: vscode.ExtensionContext) {
        // context is passed for potential future use
    }
    
    show(graph: Graph): void {
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'codegenomeAnalysis',
                'CodeGenome X Analysis',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );
            
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }
        
        this.panel.webview.html = this.getAnalysisHtml(graph);
    }
    
    showSimulation(simulation: RemovalSimulation): void {
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'codegenomeSimulation',
                'CodeGenome X Simulation',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );
            
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }
        
        this.panel.webview.html = this.getSimulationHtml(simulation);
    }
    
    private getAnalysisHtml(graph: Graph): string {
        const stats = graph.getStats();
        const nodes = graph.getAllNodes();
        
        // Calculate high impact nodes
        const highImpactNodes = nodes
            .map(node => ({
                node,
                impact: graph.removeNodeSimulation(node.id).impactScore,
            }))
            .filter(({ impact }) => impact.level === 'High' || impact.level === 'Critical')
            .sort((a, b) => b.impact.score - a.impact.score)
            .slice(0, 10);
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CodeGenome X Analysis</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    h1, h2, h3 {
                        color: var(--vscode-foreground);
                        margin-top: 0;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin: 20px 0;
                    }
                    .stat-card {
                        background: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 2em;
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                        margin-bottom: 5px;
                    }
                    .stat-label {
                        color: var(--vscode-descriptionForeground);
                        font-size: 0.9em;
                    }
                    .impact-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    .impact-table th,
                    .impact-table td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid var(--vscode-widget-border);
                    }
                    .impact-table th {
                        background: var(--vscode-editorWidget-background);
                        font-weight: bold;
                    }
                    .impact-table tr:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    .impact-critical {
                        color: var(--vscode-errorForeground);
                        font-weight: bold;
                    }
                    .impact-high {
                        color: var(--vscode-problemsWarningIcon-foreground);
                        font-weight: bold;
                    }
                    .impact-medium {
                        color: var(--vscode-problemsInfoIcon-foreground);
                    }
                    .impact-low {
                        color: var(--vscode-testing-iconPassed);
                    }
                    .node-type {
                        display: inline-block;
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 0.8em;
                        margin-right: 8px;
                    }
                    .file-path {
                        color: var(--vscode-descriptionForeground);
                        font-size: 0.9em;
                        font-family: var(--vscode-editor-font-family);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔍 CodeGenome X Analysis</h1>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalNodes}</div>
                            <div class="stat-label">Total Nodes</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalEdges}</div>
                            <div class="stat-label">Total Edges</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.averageImpactScore.toFixed(2)}</div>
                            <div class="stat-label">Avg Impact Score</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${Object.keys(stats.nodeTypes).length}</div>
                            <div class="stat-label">Node Types</div>
                        </div>
                    </div>
                    
                    <h2>⚡ High Impact Nodes</h2>
                    <table class="impact-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Impact Score</th>
                                <th>File Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${highImpactNodes.map(({ node, impact }) => `
                                <tr>
                                    <td>${node.name}</td>
                                    <td><span class="node-type">${node.type}</span></td>
                                    <td><span class="impact-${impact.level.toLowerCase()}">${impact.score.toFixed(2)} (${impact.level})</span></td>
                                    <td><div class="file-path">${node.filePath}:${node.line}</div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h2>📊 Node Type Distribution</h2>
                    <table class="impact-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(stats.nodeTypes).map(([type, count]) => {
                                const percentage = ((count / stats.totalNodes) * 100).toFixed(1);
                                return `
                                    <tr>
                                        <td><span class="node-type">${type}</span></td>
                                        <td>${count}</td>
                                        <td>${percentage}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>`;
    }
    
    private getSimulationHtml(simulation: RemovalSimulation): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CodeGenome X Simulation</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    h1, h2, h3 {
                        color: var(--vscode-foreground);
                        margin-top: 0;
                    }
                    .impact-summary {
                        background: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .impact-score {
                        font-size: 3em;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 10px;
                    }
                    .impact-critical {
                        color: var(--vscode-errorForeground);
                    }
                    .impact-high {
                        color: var(--vscode-problemsWarningIcon-foreground);
                    }
                    .impact-medium {
                        color: var(--vscode-problemsInfoIcon-foreground);
                    }
                    .impact-low {
                        color: var(--vscode-testing-iconPassed);
                    }
                    .impact-level {
                        text-align: center;
                        font-size: 1.2em;
                        margin-bottom: 20px;
                    }
                    .node-list {
                        background: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .node-item {
                        padding: 8px 0;
                        border-bottom: 1px solid var(--vscode-widget-border);
                    }
                    .node-item:last-child {
                        border-bottom: none;
                    }
                    .node-id {
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                        color: var(--vscode-descriptionForeground);
                    }
                    .warning-icon {
                        color: var(--vscode-errorForeground);
                        margin-right: 8px;
                    }
                    .success-icon {
                        color: var(--vscode-testing-iconPassed);
                        margin-right: 8px;
                    }
                    .recommendation {
                        background: var(--vscode-inputValidation-warningBackground);
                        border: 1px solid var(--vscode-inputValidation-warningBorder);
                        border-radius: 8px;
                        padding: 15px;
                        margin: 20px 0;
                    }
                    .recommendation h3 {
                        margin-top: 0;
                        color: var(--vscode-inputValidation-warningForeground);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔮 Node Removal Simulation</h1>
                    
                    <div class="impact-summary">
                        <div class="impact-score impact-${simulation.impactScore.level.toLowerCase()}">
                            ${simulation.impactScore.score.toFixed(2)}
                        </div>
                        <div class="impact-level impact-${simulation.impactScore.level.toLowerCase()}">
                            ${simulation.impactScore.level} Impact
                        </div>
                        <div style="text-align: center; color: var(--vscode-descriptionForeground);">
                            Target: ${simulation.nodeId}
                        </div>
                    </div>
                    
                    ${simulation.affectedNodes.length > 0 ? `
                        <div class="node-list">
                            <h3>📊 Affected Nodes (${simulation.affectedNodes.length})</h3>
                            ${simulation.affectedNodes.slice(0, 20).map(nodeId => `
                                <div class="node-item">
                                    <span class="warning-icon">⚠️</span>
                                    <span class="node-id">${nodeId}</span>
                                </div>
                            `).join('')}
                            ${simulation.affectedNodes.length > 20 ? `
                                <div style="text-align: center; margin-top: 10px; color: var(--vscode-descriptionForeground);">
                                    ... and ${simulation.affectedNodes.length - 20} more
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${simulation.orphanedNodes.length > 0 ? `
                        <div class="node-list">
                            <h3>🗑️ Orphaned Nodes (${simulation.orphanedNodes.length})</h3>
                            ${simulation.orphanedNodes.map(nodeId => `
                                <div class="node-item">
                                    <span class="warning-icon">🗑️</span>
                                    <span class="node-id">${nodeId}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${simulation.brokenEndpoints.length > 0 ? `
                        <div class="node-list">
                            <h3>🔗 Broken Endpoints (${simulation.brokenEndpoints.length})</h3>
                            ${simulation.brokenEndpoints.map(nodeId => `
                                <div class="node-item">
                                    <span class="warning-icon">💔</span>
                                    <span class="node-id">${nodeId}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${simulation.servicesWithoutProvider.length > 0 ? `
                        <div class="node-list">
                            <h3>⚙️ Services Without Provider (${simulation.servicesWithoutProvider.length})</h3>
                            ${simulation.servicesWithoutProvider.map(nodeId => `
                                <div class="node-item">
                                    <span class="warning-icon">⚙️</span>
                                    <span class="node-id">${nodeId}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="recommendation">
                        <h3>💡 Recommendation</h3>
                        ${simulation.impactScore.level === 'Low' && 
                          simulation.orphanedNodes.length === 0 && 
                          simulation.brokenEndpoints.length === 0 && 
                          simulation.servicesWithoutProvider.length === 0 ? `
                            <p><span class="success-icon">✅</span> Safe to remove - no significant dependencies detected.</p>
                        ` : `
                            <p><span class="warning-icon">⚠️</span> Removal not recommended due to significant dependencies.</p>
                            <ul>
                                ${simulation.orphanedNodes.length > 0 ? '<li>Will create orphaned nodes</li>' : ''}
                                ${simulation.brokenEndpoints.length > 0 ? '<li>Will break API endpoints</li>' : ''}
                                ${simulation.servicesWithoutProvider.length > 0 ? '<li>Will leave services without providers</li>' : ''}
                                ${simulation.impactScore.level === 'Critical' ? '<li>Critical impact on system architecture</li>' : ''}
                            </ul>
                        `}
                    </div>
                </div>
            </body>
            </html>`;
    }
}