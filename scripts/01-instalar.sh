#!/usr/bin/env bash
# Instala kind y kubectl (para GitHub Codespaces o cualquier Linux con Docker)
set -e
if ! command -v kind >/dev/null; then
  curl -sLo /tmp/kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
  sudo install /tmp/kind /usr/local/bin/kind
fi
if ! command -v kubectl >/dev/null; then
  curl -sLo /tmp/kubectl "https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl"
  sudo install /tmp/kubectl /usr/local/bin/kubectl
fi
docker --version
kind --version
kubectl version --client
