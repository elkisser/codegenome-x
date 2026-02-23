import { AnalysisEngine } from '../core/src/index';
import * as path from 'path';
import * as fs from 'fs';

// Simple implementation of a progress bar/spinner
class SimpleSpinner {
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private i = 0;
    private interval: NodeJS.Timeout | null = null;
    private text: string;

    constructor(text: string) {
        this.text = text;
    }

    start() {
        process.stdout.write('\n' + this.text + '\n');
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.i]} ${this.text}`);
            this.i = (this.i + 1) % this.frames.length;
        }, 80);
    }

    succeed(message: string) {
        this.stop();
        process.stdout.write(`\r✅ ${message}          \n`);
    }

    fail(message: string) {
        this.stop();
        process.stdout.write(`\r❌ ${message}          \n`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    update(text: string) {
        this.text = text;
    }
}

async function runTest() {
    // console.clear();
    console.log('🚀 CodeGenome X - Análisis de Endpoints\n');
    
    // Ruta al backend del Club del Barril
    const projectPath = 'c:\\Users\\Usuario\\Desktop\\TRABAJO\\club-del-barril\\club-barril-backend';
    
    if (!fs.existsSync(projectPath)) {
        console.error(`❌ Error: No se encuentra la ruta: ${projectPath}`);
        process.exit(1);
    }

    const spinner = new SimpleSpinner('Inicializando motor...');
    spinner.start();
    
    const engine = new AnalysisEngine();
    let originalLog = console.log;
    
    try {
        spinner.update(`Escaneando APIs en: ${path.basename(projectPath)}...`);
        
        // Mocking console.log to avoid spamming the spinner
        console.log = () => {}; 

        const result = await engine.analyze({
            projectPath,
            includePatterns: ['**/*.ts', '**/*.js'], 
            excludePatterns: ['node_modules/**', 'dist/**', 'test/**', '**/*.spec.ts'],
            maxWorkers: 4,
            enableCache: false
        });

        // Restore console.log
        console.log = originalLog;
        spinner.succeed('Análisis finalizado.');

        const graph = result.graph;
        const nodes = graph.getAllNodes();
        
        // --- Endpoint Analysis Logic ---
        const endpoints = nodes.filter(n => n.type === 'endpoint');
        
        // Categorize Endpoints
        const publicEndpoints = endpoints.filter(e => e.metadata?.isPublic);
        const protectedEndpoints = endpoints.filter(e => e.metadata?.isProtected);
        const unknownAuthEndpoints = endpoints.filter(e => !e.metadata?.isPublic && !e.metadata?.isProtected);
        
        // Group by Controller (File)
        const endpointsByFile = new Map<string, typeof endpoints>();
        endpoints.forEach(e => {
            const file = path.basename(e.filePath);
            if (!endpointsByFile.has(file)) endpointsByFile.set(file, []);
            endpointsByFile.get(file)?.push(e);
        });

        console.log('\n📊 REPORTE DE APIs & ENDPOINTS');
        console.log('================================');
        console.log(`📡 Total de Endpoints:   ${endpoints.length}`);
        console.log(`📂 Controladores:        ${endpointsByFile.size}`);
        console.log(`🔒 Protegidos (Auth):    ${protectedEndpoints.length}`);
        console.log(`🔓 Públicos / Abiertos:  ${unknownAuthEndpoints.length + publicEndpoints.length}`);
        console.log('================================\n');

        if (unknownAuthEndpoints.length > 0) {
            console.log('⚠️  OPORTUNIDADES DE SEGURIDAD DETECTADAS');
            console.log(`Se detectaron ${unknownAuthEndpoints.length} endpoints sin decoradores de seguridad explícitos (@UseGuards, @Auth).`);
            console.log('Aunque pueden estar protegidos a nivel de Controlador, se recomienda auditar los siguientes grupos:\n');

            // Show top 5 files with most unprotected endpoints
            const sortedFiles = Array.from(endpointsByFile.entries())
                .map(([file, eps]) => ({
                    file,
                    unprotected: eps.filter(e => !e.metadata?.isProtected && !e.metadata?.isPublic).length
                }))
                .filter(x => x.unprotected > 0)
                .sort((a, b) => b.unprotected - a.unprotected)
                .slice(0, 5);

            sortedFiles.forEach(({ file, unprotected }) => {
                console.log(`📄 ${file} (${unprotected} endpoints abiertos)`);
                const examples = endpointsByFile.get(file)!
                    .filter(e => !e.metadata?.isProtected && !e.metadata?.isPublic)
                    .slice(0, 3);
                examples.forEach(e => console.log(`   └─ ${e.name}`));
                if (unprotected > 3) console.log(`   └─ ... y ${unprotected - 3} más`);
                console.log('');
            });
        }

        console.log('💡 RECOMENDACIÓN DE ARQUITECTURA');
        console.log('--------------------------------');
        if (endpoints.length > 50 && protectedEndpoints.length < endpoints.length * 0.5) {
            console.log('👉 Se detecta un bajo porcentaje de endpoints con seguridad explícita.');
            console.log('   Recomendación: Implementar un Guard global o validar si los decoradores de clase están siendo detectados.');
            console.log('   Conectar estos endpoints a `JwtAuthGuard` o `RolesGuard` es prioritario.');
        } else {
            console.log('✅ La cobertura de seguridad parece adecuada.');
        }

    } catch (error) {
        console.log = originalLog; // Restore log if error
        spinner.fail('Error crítico durante el análisis');
        console.error(error);
        process.exit(1);
    }
}

runTest();
