#!/usr/bin/env bash
# Ejecuta k6 DENTRO del clúster contra el Service "backend" (balanceado entre réplicas)
# Uso: scripts/04-k6.sh <VUS> <etiqueta>      ej: scripts/04-k6.sh 25 normal
set -e
cd "$(dirname "$0")/.."
VUS=${1:-10}; ETIQUETA=${2:-normal}; DURACION=${DURATION:-1m}
mkdir -p resultados
[ -f .token ] || scripts/03-token.sh
kubectl -n smartplant delete pod k6 --ignore-not-found >/dev/null
kubectl -n smartplant run k6 --rm -i --restart=Never --image=grafana/k6 \
  --env="BASE_URL=http://backend:3000" --env="TOKEN=$(cat .token)" \
  --env="VUS=$VUS" --env="DURATION=$DURACION" \
  -- run --quiet - < backend/performance/k6/load-test.js \
  | tee "resultados/k6-${ETIQUETA}-${VUS}vus.txt"
echo "📄 Guardado en resultados/k6-${ETIQUETA}-${VUS}vus.txt"
