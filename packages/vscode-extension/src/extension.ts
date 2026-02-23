import * as vscode from 'vscode';
import { AnalysisEngine } from '@codegenome-x/core';
import { CodeGenomeProvider } from './tree-provider';
import { WebviewPanel } from './webview-panel';

let analysisEngine: AnalysisEngine;
let treeDataProvider: CodeGenomeProvider;
let webviewPanel: WebviewPanel | undefined;
let extensionContext: vscode.ExtensionContext;
let autoAnalysisDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    console.log('CodeGenome X extension is now active');
    
    // Initialize Core Engine
    // Delay initialization until first use if possible, but AnalysisEngine seems light.
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
    
    // Configuration listener
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codegenome.enableAutoAnalysis')) {
            setupAutoAnalysis(context);
        }
    }));

    setupAutoAnalysis(context);
}

function setupAutoAnalysis(context: vscode.ExtensionContext) {
    if (autoAnalysisDisposable) {
        autoAnalysisDisposable.dispose();
        autoAnalysisDisposable = undefined;
    }

    const config = vscode.workspace.getConfiguration('codegenome');
    if (config.get('enableAutoAnalysis')) {
        autoAnalysisDisposable = vscode.workspace.onDidSaveTextDocument(() => {
            // Debounce could be added here
            analyzeProject();
        });
        context.subscriptions.push(autoAnalysisDisposable);
    }
}

export function deactivate() {
    console.log('CodeGenome X extension is now deactivated');
    if (webviewPanel) {
        // webviewPanel.dispose(); // If WebviewPanel has dispose method
    }
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open');
        return undefined;
    }

    if (workspaceFolders.length === 1) {
        return workspaceFolders[0];
    }

    return await vscode.window.showWorkspaceFolderPick({
        placeHolder: 'Select workspace folder to analyze'
    });
}

async function analyzeProject() {
    const workspaceFolder = await pickWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }
    
    const projectPath = workspaceFolder.uri.fsPath;
    const config = vscode.workspace.getConfiguration('codegenome');
    
    const progress = vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'CodeGenome X Analysis',
        cancellable: true,
    }, async (progress, token) => {
        progress.report({ message: 'Analyzing project structure...' });
        
        if (token.isCancellationRequested) {
            return;
        }

        try {
            // TODO: Pass cancellation token to analysisEngine if supported
            const result = await analysisEngine.analyze({
                projectPath,
                includePatterns: config.get('includePatterns'),
                excludePatterns: config.get('excludePatterns'),
                maxWorkers: config.get('maxWorkers'),
                enableCache: true,
            });
            
            if (token.isCancellationRequested) {
                return;
            }

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
                webviewPanel = new WebviewPanel(extensionContext);
            }
            webviewPanel.show(graph);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
            console.error(error);
        }
    });
    
    await progress;
}

async function simulateNodeRemoval(nodeId?: string) {
    try {
        const graph = analysisEngine.getGraph();
        if (!graph) {
            vscode.window.showWarningMessage('Please run analysis first.');
            return;
        }

        if (!nodeId) {
            const nodes = graph.getAllNodes();
            const items = nodes.map(n => ({
                label: n.name,
                description: n.filePath,
                nodeId: n.id
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a node to simulate removal'
            });
            
            if (selected) {
                nodeId = selected.nodeId;
            } else {
                return;
            }
        }

        const simulation = graph.removeNodeSimulation(nodeId);
        
        // Show results in webview
        if (!webviewPanel) {
            webviewPanel = new WebviewPanel(extensionContext);
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

async function exploreNode(nodeId?: string) {
    const graph = analysisEngine.getGraph();
    if (!graph) {
        return;
    }

    if (!nodeId) {
        // Could show quick pick, but usually this command is called from UI
        return;
    }

    const node = graph.getNode(nodeId);
    
    if (!node) {
        vscode.window.showErrorMessage('Node not found');
        return;
    }
    
    // Open file and reveal node location
    try {
        const document = await vscode.workspace.openTextDocument(node.filePath);
        const editor = await vscode.window.showTextDocument(document);
        
        const line = Math.max(0, node.line - 1); // Ensure non-negative
        const column = Math.max(0, node.column);
        
        const position = new vscode.Position(line, column);
        const range = new vscode.Range(position, position);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (e) {
        vscode.window.showErrorMessage(`Could not open file: ${node.filePath}`);
    }
}
