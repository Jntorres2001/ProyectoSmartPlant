#!/usr/bin/env bash
# Degrada la red de TODOS los pods del backend con tc/netem, o mide con iperf3.
# Uso:
#   scripts/05-red.sh normal      -> quita cualquier degradación
#   scripts/05-red.sh latencia    -> +150 ms de retardo (±20 ms)
#   scripts/05-red.sh perdida     -> 10 % de pérdida de paquetes
#   scripts/05-red.sh ambas       -> 150 ms + 10 % de pérdida
#   scripts/05-red.sh estado      -> muestra la regla tc de cada pod
#   scripts/05-red.sh iperf <etiqueta>  -> iperf3 backend -> iperf3-server (10 s)
#   scripts/05-red.sh ping <etiqueta>   -> latencia backend -> mysql
cd "$(dirname "$0")/.."
MODO=${1:-estado}; ETIQUETA=${2:-$MODO}
PODS=$(kubectl -n smartplant get pods -l app=backend -o jsonpath='{.items[*].metadata.name}')
mkdir -p resultados

aplicar() {
  for p in $PODS; do
    kubectl -n smartplant exec "$p" -- sh -c "tc qdisc del dev eth0 root 2>/dev/null; $1"
    echo "$p: $(kubectl -n smartplant exec "$p" -- tc qdisc show dev eth0)"
  done
}

case "$MODO" in
  normal)   aplicar "true" ;;
  latencia) aplicar "tc qdisc add dev eth0 root netem delay 150ms 20ms" ;;
  perdida)  aplicar "tc qdisc add dev eth0 root netem loss 10%" ;;
  ambas)    aplicar "tc qdisc add dev eth0 root netem delay 150ms 20ms loss 10%" ;;
  estado)   for p in $PODS; do echo "$p: $(kubectl -n smartplant exec "$p" -- tc qdisc show dev eth0)"; done ;;
  iperf)
    P=$(echo $PODS | cut -d' ' -f1)
    kubectl -n smartplant exec "$P" -- iperf3 -c iperf3-server -t 10 | tee "resultados/iperf3-${ETIQUETA}.txt" ;;
  ping)
    P=$(echo $PODS | cut -d' ' -f1)
    kubectl -n smartplant exec "$P" -- ping -c 20 mysql \
      | tee "resultados/ping-${ETIQUETA}.txt" ;;
  *) echo "Modo no válido: $MODO"; exit 1 ;;
esac
