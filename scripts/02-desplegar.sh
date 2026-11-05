#!/usr/bin/env bash
# Crea el clúster, construye las imágenes y despliega SmartPlant en Kubernetes
set -e
cd "$(dirname "$0")/.."

kind get clusters | grep -q '^smartplant$' || kind create cluster --config k8s/kind-config.yaml

echo "==> Construyendo imágenes Docker"
docker build -t smartplant-backend:1.0 backend
docker build -t smartplant-frontend:1.0 frontend

echo "==> Cargando imágenes en los nodos del clúster"
kind load docker-image smartplant-backend:1.0 smartplant-frontend:1.0 --name smartplant

echo "==> Aplicando manifiestos"
kubectl apply -f k8s/00-namespace.yaml
kubectl create configmap mysql-init --from-file=database.sql=backend/database.sql \
  -n smartplant --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/01-secret.yaml -f k8s/02-mysql.yaml -f k8s/03-redis.yaml -f k8s/06-iperf3.yaml
kubectl -n smartplant rollout status deploy/mysql --timeout=300s
kubectl apply -f k8s/04-backend.yaml -f k8s/05-frontend.yaml
kubectl -n smartplant rollout status deploy/backend --timeout=300s
kubectl -n smartplant rollout status deploy/frontend --timeout=180s

kubectl -n smartplant get deploy,pods -o wide
kubectl -n smartplant get svc
echo
echo "✅ Listo. Abre la pestaña PORTS de Codespaces y abre el puerto 8080 en el navegador."
