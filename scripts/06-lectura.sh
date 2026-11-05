#!/usr/bin/env bash
# Simula al ESP32 enviando lecturas (para ver el tiempo real en varios navegadores)
# Uso: scripts/06-lectura.sh [cantidad]
N=${1:-10}
for i in $(seq 1 "$N"); do
  H=$(( (RANDOM % 60) + 20 ))
  echo -n "Lectura $i (humedad $H%) -> "
  curl -s -D - -o /dev/null -X POST http://localhost:8080/api/lecturas \
    -H 'Content-Type: application/json' -H 'x-api-key: sp_demo_apikey_cambiala_123456' \
    -d "{\"humedad\":$H,\"voltaje\":3.3,\"senal_wifi\":-60}" | grep -iE "^HTTP|^x-pod" | tr -d '\r' | tr '\n' ' '
  echo; sleep 3
done
