#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== CONTROL Peatonal — inicio en Railway ==="
echo "Directorio: $(pwd)"
echo "Python: $(python --version 2>&1)"

REQUIRED=(SECRET_KEY DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT)
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Falta la variable de entorno obligatoria: $var"
    echo "Agregala en Railway → Variables → $var"
    exit 1
  fi
done

echo "Variables obligatorias: OK"
echo "Probando carga de Django..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
print('Django cargado correctamente')
"

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

echo "Iniciando Gunicorn en puerto ${PORT:-8000}..."
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 2 \
  --timeout 120 \
  --log-level info \
  --capture-output \
  --enable-stdio-inheritance
