#!/bin/bash

# Script para extraer solo los datos del backup SQL (sin estructura)
# Uso: ./extract_data_only.sh backup_complete.sql data_only.sql

INPUT_FILE="backup_complete.sql"
OUTPUT_FILE="data_only.sql"

# Verificar que el archivo de entrada existe
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: El archivo $INPUT_FILE no existe"
    exit 1
fi

echo "Extrayendo solo los datos de $INPUT_FILE..."

# Crear archivo de salida con encabezado básico
cat > "$OUTPUT_FILE" << 'EOF'
--
-- Datos extraídos del backup completo
-- Solo datos, sin estructura de tablas
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

EOF

# Extraer solo las secciones COPY con sus datos
awk '
    /^-- Data for Name:/ { in_data_section = 1; print; next }
    /^COPY/ && in_data_section { in_copy = 1; print; next }
    /^\\.$/ && in_copy { print; in_copy = 0; in_data_section = 0; next }
    in_copy { print }
    /^$/ && in_data_section && !in_copy { print }
' "$INPUT_FILE" >> "$OUTPUT_FILE"

echo "Datos extraídos exitosamente en $OUTPUT_FILE"
echo "Tamaño del archivo original: $(du -h $INPUT_FILE | cut -f1)"
echo "Tamaño del archivo de datos: $(du -h $OUTPUT_FILE | cut -f1)"

# Mostrar estadísticas
echo ""
echo "Estadísticas:"
echo "- Tablas con datos: $(grep -c "^COPY" "$OUTPUT_FILE")"
echo "- Total de líneas de datos: $(grep -v "^--" "$OUTPUT_FILE" | grep -v "^$" | grep -v "^SET" | grep -v "^SELECT" | grep -v "^COPY" | grep -v "^\\\.$" | wc -l)"
