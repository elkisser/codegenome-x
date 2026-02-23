# CodeGenome X: Guía Definitiva de Publicación y Pruebas

Este documento es tu biblia para llevar la extensión desde tu máquina local hasta el Marketplace oficial de VS Code, sin depender de nadie.

---

## 🏗️ Fase 1: Preparación del Entorno (Local)

Antes de subir nada, asegúrate de que todo compile y funcione como un reloj suizo.

### 1. Limpieza y Recompilación Total
Ejecuta esto en tu terminal (en la carpeta `packages/vscode-extension`) para asegurar un build limpio:

```bash
# Elimina cualquier residuo anterior
npm run clean

# Reinstala dependencias (asegúrate de que no haya errores de red)
npm install

# Compila el código de producción (minificado y optimizado)
npm run package
```

> **Verificación**: Deberías ver un archivo `dist/extension.js` de varios MB. Si pesa menos de 500KB, algo salió mal con el bundling.

---

## 🧪 Fase 2: Pruebas Locales (QA)

No confíes en el código hasta verlo correr.

### Opción A: Debugging en Tiempo Real (Recomendado para Desarrollo)
1. Abre el proyecto en VS Code.
2. Ve a la pestaña **Run and Debug** (Ctrl+Shift+D).
3. Selecciona **"Run Extension"** y dale al Play (F5).
4. Se abrirá una nueva ventana de VS Code (**Extension Host**).
5. Arrastra tu proyecto `club-del-barril` (backend) a esa ventana.
6. Abre la paleta de comandos (`Ctrl+Shift+P`) y ejecuta:
   - `CodeGenome X: Analyze Project Structure`
   - Espera a ver los resultados en la barra lateral.
   - Revisa la consola de depuración para ver logs detallados.

### Opción B: Instalación del Empaquetado Real (Simulación de Usuario Final)
Para probar exactamente lo que el usuario recibirá:

1. Genera el instalador `.vsix`:
   ```bash
   npx vsce package
   ```
   *(Si te pide un Personal Access Token, dile que 'no' por ahora, solo queremos empaquetar localmente).*

2. Instálalo en tu VS Code principal:
   - Ve a la pestaña de **Extensiones** (Ctrl+Shift+X).
   - Clic en los 3 puntos (`...`) arriba a la derecha -> **Install from VSIX...**
   - Selecciona el archivo `codegenome-x-1.0.0.vsix` que acabas de crear.
   - Reinicia VS Code.

3. Verifica que funcione igual que en debug.

---

## 🚀 Fase 3: Publicación al Mundo

Para que otros instalen tu extensión desde el Marketplace, necesitas una cuenta de publicador.

### Paso 1: Crear Cuenta en Azure DevOps (Obligatorio)
Microsoft usa Azure para gestionar las extensiones.
1. Ve a [dev.azure.com](https://dev.azure.com) e inicia sesión con tu cuenta Microsoft/GitHub.
2. Crea una "Organization" (si no tienes una). Ponle un nombre cualquiera.
3. Ve a **User Settings** (arriba a la derecha, icono usuario) -> **Personal Access Tokens**.
4. Clic en **New Token**:
   - **Name**: `VSCode Marketplace`
   - **Organization**: `All accessible organizations`
   - **Expiration**: `1 year` (recomendado).
   - **Scopes**: Busca `Marketplace` y selecciona **Acquire** y **Manage** (o `All scopes` si te da pereza buscar).
5. **COPIA EL TOKEN**. No lo volverás a ver.

### Paso 2: Crear el Publisher en Marketplace
1. Ve a [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).
2. Inicia sesión.
3. Clic en **Create Publisher**.
   - **Name**: `CodeGenomeX` (debe coincidir con el `publisher` en `package.json`).
   - **ID**: `codegenome-x` (este es el identificador real).
   - Rellena el resto.

### Paso 3: Publicar desde la Terminal
Ahora vuelve a tu terminal en `packages/vscode-extension`:

1. Inicia sesión con `vsce` usando el token que copiaste:
   ```bash
   npx vsce login CodeGenomeX
   ```
   *(Pega el token cuando te lo pida).*

2. Publica la extensión:
   ```bash
   npx vsce publish
   ```
   - Si es la primera vez, puede tardar unos minutos en aparecer en el Marketplace.
   - VS Code verificará el paquete por virus y contenido.

---

## 🎨 Fase 4: Pulido Final (Imagen y Branding)

Para que se vea profesional en la tienda:

1. **Icono**:
   - Crea una imagen PNG de 128x128 píxeles.
   - Guárdala como `resources/icon.png` en la carpeta de la extensión.
   - Descomenta la línea `"icon": "resources/icon.png"` en `package.json`.

2. **README**:
   - Edita `README.md` con capturas de pantalla (GIFs animados son mejores).
   - Sube las imágenes a GitHub o un host público y enlázalas en el Markdown.

3. **Repositorio**:
   - Asegúrate de que el campo `repository` en `package.json` apunte a tu repo público real si quieres que aparezca el enlace "Repository" en la tienda.

---

## 🆘 Solución de Problemas Comunes

- **Error: "Missing publisher name"**:
  - Asegúrate de que `"publisher": "CodeGenomeX"` esté en `package.json`.
- **Error: "SVG icons are not supported"**:
  - Usa PNG para el icono principal.
- **La extensión pesa demasiado (>100MB)**:
  - Revisa que no estés empaquetando `node_modules` innecesarios. `esbuild` debería encargarse de esto, pero revisa el archivo `.vscodeignore` si existe (o créalo para excluir carpetas de dev).
- **El análisis falla en producción pero no en debug**:
  - Probablemente un problema de rutas relativas o archivos binarios no incluidos. Revisa los `assets` en `package.json`.

¡Suerte con el lanzamiento! 🚀
