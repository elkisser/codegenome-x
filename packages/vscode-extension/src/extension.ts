import * as vscode from 'vscode';
import { AnalysisEngine, GraphNode, ImpactScore } from '@codegenome-x/core';
import { CodeGenomeProvider } from './tree-provider';
import { WebviewPanel } from './webview-panel';

let analysisEngine: AnalysisEngine;
let treeDataProvider: CodeGenomeProvider;
let webviewPanel: WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeGenome X extension is now active');
    
    analysisEngine = new AnalysisEngine();
    treeDataProvider = new CodeGenomeProvider();
    
    // Register tree data provider
    const treeView = vscode.window.createTreeView('codegenomeExplorer', {
        treeDataProvider,
        showCollapseAll: true,
    });
    
    // Register commands
    const analyzeCommand = vscode.commands.registerCommand('codegenome.analyze', analyzeProject);
    const simulateCommand = vscode.commands.registerCommand('codegenome.simulate', simulateNodeRemoval);
    const refreshCommand = vscode.commands.registerCommand('codegenome.refresh', refreshAnalysis);
    const exploreCommand = vscode.commands.registerCommand('codegenome.exploreNode', exploreNode);
    
    context.subscriptions.push(
        treeView,
        analyzeCommand,
        simulateCommand,
        refreshCommand,
        exploreCommand
    );
    
    // Auto-analysis on save if enabled
    const config = vscode.workspace.getConfiguration('codegenome');
    if (config.get('enableAutoAnalysis')) {
        const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
            analyzeProject();
        });
        context.subscriptions.push(saveListener);
    }
}

export function deactivate() {
    console.log('CodeGenome X extension is now deactivated');
}

async function analyzeProject() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
    }
    
    const projectPath = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('codegenome');
    
    const progress = vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'CodeGenome X Analysis',
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: 'Analyzing project structure...' });
        
        try {
            const result = await analysisEngine.analyze({
                projectPath,
                includePatterns: config.get('includePatterns'),
                excludePatterns: config.get('excludePatterns'),
                maxWorkers: config.get('maxWorkers'),
                enableCache: true,
            });
            
            progress.report({ message: 'Updating results...' });
            
            const graph = result.graph;
            const stats = graph.getStats();
            const nodes = graph.getAllNodes();
            
            // Update tree view
            treeDataProvider.updateData(graph);
            
            // Show summary
            const message = `Analysis complete: ${nodes.length} nodes, ${stats.totalEdges} edges, Avg Impact: ${stats.averageImpactScore.toFixed(2)}`;
            vscode.window.showInformationMessage(message);
            
            // Show webview if not already open
            if (!webviewPanel) {
                webviewPanel = new WebviewPanel(context);
            }
            webviewPanel.show(graph);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
        }
    });
    
    await progress;
}

async function simulateNodeRemoval(nodeId: string) {
    try {
        const graph = analysisEngine.getGraph();
        const simulation = graph.removeNodeSimulation(nodeId);
        
        // Show results in webview
        if (!webviewPanel) {
            webviewPanel = new WebviewPanel(context);
        }
        webviewPanel.showSimulation(simulation);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Simulation failed: ${errorMessage}`);
    }
}

async function refreshAnalysis() {
    await analyzeProject();
}

async function exploreNode(nodeId: string) {
    const graph = analysisEngine.getGraph();
    const node = graph.getNode(nodeId);
    
    if (!node) {
        vscode.window.showErrorMessage('Node not found');
        return;
    }
    
    // Open file and reveal node location
    const document = await vscode.workspace.openTextDocument(node.filePath);
    const editor = await vscode.window.showTextDocument(document);
    
    const position = new vscode.Position(node.line - 1, node.column);
    const range = new vscode.Range(position, position);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}