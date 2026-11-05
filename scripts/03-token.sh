#!/usr/bin/env bash
# Registra un usuario de prueba y guarda su JWT en .token (lo usan k6 y el monitor)
cd "$(dirname "$0")/.."
CORREO="k6_$(date +%s)@smartplant.test"
RESP=$(curl -s -X POST http://localhost:8080/api/auth/registro \
  -H 'Content-Type: application/json' \
  -d "{\"nombre\":\"Usuario Pruebas\",\"correo\":\"$CORREO\",\"password\":\"Pruebas2026!\"}")
TOKEN=$(echo "$RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then echo "❌ No se obtuvo token: $RESP"; exit 1; fi
echo "$TOKEN" > .token
echo "✅ Token guardado en .token (usuario $CORREO)"
