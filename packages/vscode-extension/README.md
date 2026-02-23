# CodeGenome X

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**CodeGenome X** es un motor de análisis estructural profesional para VS Code. Permite visualizar la arquitectura de tu proyecto, detectar "God Classes", encontrar código muerto y analizar la seguridad de tus endpoints API.

## Características Principales

### 🔍 Análisis Estructural Profundo
- Visualiza tu proyecto como un grafo de nodos interconectados.
- Detecta dependencias ocultas entre archivos.
- Soporte nativo para TypeScript, JavaScript, React y PHP (Symfony).

### 🛡️ Auditoría de Seguridad de APIs (Nuevo)
- Escanea automáticamente tus controladores (NestJS, Express, Symfony).
- Identifica endpoints públicos vs. protegidos.
- Alerta sobre rutas sin autenticación explícita (`@UseGuards`, `@Auth`).

### ⚡ Simulación de Impacto
- ¿Qué pasa si borro este archivo? CodeGenome X te lo dice antes de que lo hagas.
- Calcula el "Impact Score" de cada componente.

## Cómo Usar

1. Abre un proyecto en VS Code.
2. Ejecuta el comando `CodeGenome X: Analyze Project Structure`.
3. Explora el árbol de dependencias en la barra lateral.
4. Haz clic derecho en un nodo para simular su eliminación.

## Configuración

Puedes personalizar el análisis en `settings.json`:

```json
{
  "codegenome.includePatterns": ["**/*.ts", "**/*.js"],
  "codegenome.excludePatterns": ["node_modules/**", "dist/**"],
  "codegenome.maxWorkers": 4
}
```

## Requisitos

- VS Code 1.74.0 o superior.
- Node.js 16+ (para desarrollo).

## Licencia

MIT
