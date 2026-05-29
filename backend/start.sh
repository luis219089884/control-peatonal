#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== CONTROL Peatonal — Railway ==="
echo "Directorio: $(pwd)"

if [ -z "${PORT}" ]; then
  echo "ERROR: Falta PORT. Railway lo inyecta al arrancar; no crees PORT=8000 manualmente."
  exit 1
fi

if [ -z "${SECRET_KEY}" ]; then
  echo "ERROR: Falta SECRET_KEY en Variables."
  exit 1
fi

echo "PORT=${PORT}"
echo "DB_HOST=${DB_HOST:-NO DEFINIDO}"

echo "Probando carga de Django..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
print('Django OK')
"

echo "Migraciones..."
python manage.py migrate --noinput || echo "AVISO: migrate fallo (revisa DB_HOST / Session pooler Supabase)"

echo "Gunicorn en 0.0.0.0:${PORT}"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers 2 \
  --timeout 120 \
  --log-level info \
  --access-logfile - \
  --error-logfile -
