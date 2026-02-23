# CodeGenome X Testing Guide

## 1. Setup Local

Este proyecto usa un monorepo. Para desarrollar la extensión con el Core local, sigue estos pasos:

### Opción A (Recomendada si pnpm funciona):
```bash
# En la raíz
pnpm install
pnpm build
```

### Opción B (Si tienes problemas con pnpm/workspace):
1. Navega a `packages/core` e instala dependencias:
   ```bash
   cd packages/core
   npm install
   npm run build
   ```
2. Navega a `packages/vscode-extension` e instala dependencias:
   ```bash
   cd packages/vscode-extension
   npm install
   ```
   > Nota: `package.json` de la extensión ha sido modificado para apuntar a `file:../core` en lugar de `workspace:*`.

## 2. Ejecutar la Extensión en Modo Debug

1. Abre la carpeta raíz `codegenome-x` en VS Code.
2. Ve a la pestaña **Run and Debug** (Ctrl+Shift+D).
3. Selecciona la configuración **Run Extension**.
4. Presiona F5.
   - Esto compilará automáticamente la extensión usando `esbuild` y abrirá una nueva ventana de VS Code (**Extension Development Host**).

## 3. Validar Funcionalidad con Proyecto Real (Club del Barril)

### Paso 1: Abrir Workspace Multi-Repo
En la ventana de **Extension Development Host**:
1. Usa **File > Add Folder to Workspace...**
2. Selecciona las carpetas de los repositorios del proyecto "club-del-barril" (ej: `club-del-barril-frontend`, `club-del-barril-backend`, etc.).
3. Guarda el workspace si lo deseas (`.code-workspace`).

### Paso 2: Ejecutar Análisis
1. Abre la Command Palette (Ctrl+Shift+P).
2. Ejecuta `CodeGenome X: Analyze Project Structure`.
3. Si tienes múltiples carpetas, te pedirá elegir cuál analizar. Selecciona una (ej: el backend).
4. Verifica que aparezca una notificación de progreso ("Analyzing project structure...").
5. Al terminar, deberías ver:
   - Notificación de éxito con estadísticas (nodos, edges, avg impact).
   - El panel **CodeGenome X Explorer** en la barra lateral se llena con un árbol de nodos.
   - Un **Webview Panel** se abre mostrando gráficos y tablas de impacto.

### Paso 3: Simular Eliminación de Nodo
1. En el **CodeGenome X Explorer**, expande una categoría (ej: `Service`).
2. Haz clic derecho en un nodo y selecciona **Simulate Node Removal**.
   - O usa el icono inline (papelera/rayo) si aparece.
3. Se abrirá/actualizará el Webview con el reporte de simulación:
   - Score de impacto.
   - Nodos afectados.
   - Recomendación (Safe/Unsafe).

### Paso 4: Explorar Nodo
1. Haz clic en un nodo del árbol.
2. Debería abrir el archivo correspondiente y saltar a la línea exacta de definición.

### Paso 5: Auto-Análisis
1. Abre `Settings` (Ctrl+,) y busca `codegenome`.
2. Activa `Enable Auto Analysis`.
3. Abre un archivo del proyecto analizado, haz un cambio trivial (espacio) y guarda (Ctrl+S).
4. Debería dispararse el análisis automáticamente (observa la barra de estado o notificaciones).

## 4. Troubleshooting

- **No aparecen nodos**: Revisa la configuración `codegenome.includePatterns`. Asegúrate de que coincida con los archivos del proyecto (ej: `**/*.ts`, `**/*.php`).
- **Errores en consola**: Abre **Help > Toggle Developer Tools** en la ventana de Extension Host para ver logs detallados.
- **Build fallido**: Si `npm run build` falla, asegúrate de tener `esbuild` instalado. Ejecuta `npm install` en `packages/vscode-extension`.

## 5. Generar VSIX (Installable Build)

Para generar el archivo `.vsix` instalable:

```bash
cd packages/vscode-extension
npm run package
npx vsce package
```

Esto generará `codegenome-x-1.0.0.vsix` que puedes instalar en cualquier VS Code con `code --install-extension codegenome-x-1.0.0.vsix`.
