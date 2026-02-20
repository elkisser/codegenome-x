#!/bin/bash

# Script para conectar tu repositorio local con GitHub y hacer push

echo "🚀 CodeGenome X - GitHub Setup Script"
echo "======================================"
echo ""
echo "Este script te ayudará a conectar tu repositorio local con GitHub."
echo ""
echo "PASO 1: Crea el repositorio en GitHub primero"
echo "- Ve a https://github.com/new"
echo "- Nombre del repositorio: codegenome-x"
echo "- Descripción: Professional multi-language structural analysis engine"
echo "- Hazlo público"
echo "- NO inicialices con README"
echo ""
echo "Presiona ENTER cuando hayas creado el repositorio en GitHub..."
read

echo ""
echo "PASO 2: Configura el remote origin"
echo "Copia y pega este comando (reemplaza TU_USUARIO con tu usuario de GitHub):"
echo ""
echo "git remote add origin https://github.com/TU_USUARIO/codegenome-x.git"
echo ""
echo "Presiona ENTER cuando hayas ejecutado el comando anterior..."
read

echo ""
echo "PASO 3: Renombra la rama principal (si es necesario)"
echo "Si tu rama actual no se llama 'main', ejecuta:"
echo "git branch -M main"
echo ""
echo "Presiona ENTER para continuar..."
read

echo ""
echo "PASO 4: Haz push al repositorio"
echo "Ejecuta este comando:"
echo "git push -u origin main"
echo ""
echo "¡Listo! Tu proyecto CodeGenome X estará en GitHub."
echo ""
echo "🎉 ¡Felicidades! Tu repositorio está ahora en GitHub."
echo ""
echo "Enlaces útiles que aparecerán después del push:"
echo "- https://github.com/TU_USUARIO/codegenome-x"
echo "- Puedes compartir tu proyecto con el mundo!"