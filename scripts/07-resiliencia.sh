#!/usr/bin/env bash
# Pruebas de resiliencia. Deja corriendo el monitor en otra terminal (ver GUIA).
# Uso:
#   scripts/07-resiliencia.sh backend   -> elimina 1 pod del backend
#   scripts/07-resiliencia.sh todos     -> elimina TODOS los pods del backend
#   scripts/07-resiliencia.sh mysql     -> elimina el pod de MySQL
#   scripts/07-resiliencia.sh redis     -> apaga Redis (replicas=0) ; "redis-on" lo vuelve a encender
#   scripts/07-resiliencia.sh nodo      -> apaga un nodo worker completo (docker stop)
NS="-n smartplant"
case "$1" in
  backend) P=$(kubectl $NS get pods -l app=backend -o jsonpath='{.items[0].metadata.name}')
           echo "Eliminando $P a las $(date +%T)"; kubectl $NS delete pod "$P" --wait=false ;;
  todos)   echo "Eliminando todos los backend a las $(date +%T)"; kubectl $NS delete pod -l app=backend --wait=false ;;
  mysql)   echo "Eliminando MySQL a las $(date +%T)"; kubectl $NS delete pod -l app=mysql --wait=false ;;
  redis)   kubectl $NS scale deploy/redis --replicas=0 ;;
  redis-on) kubectl $NS scale deploy/redis --replicas=1 ;;
  nodo)    echo "Apagando smartplant-worker2 a las $(date +%T)"; docker stop smartplant-worker2 ;;
  nodo-on) docker start smartplant-worker2 ;;
  *) echo "Uso: $0 backend|todos|mysql|redis|redis-on|nodo|nodo-on"; exit 1 ;;
esac
kubectl $NS get pods -o wide -w
