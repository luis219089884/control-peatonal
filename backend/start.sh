#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== CONTROL Peatonal — Railway ==="
echo "Directorio: $(pwd)"

if [ -z "${PORT}" ]; then
  echo "ERROR: Falta la variable PORT (Railway la inyecta automaticamente)."
  echo "NO uses el puerto 8000 de runserver local. Borra PORT=8000 en Variables si la creaste."
  exit 1
fi

echo "Gunicorn escuchara en 0.0.0.0:${PORT}"
echo "En Ajustes -> Redes publicas, el puerto del dominio debe ser: ${PORT}"

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers 2 \
  --timeout 120 \
  --log-level info \
  --access-logfile - \
  --error-logfile -
