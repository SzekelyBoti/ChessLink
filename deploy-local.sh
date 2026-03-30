#!/usr/bin/env bash
# deploy-local.sh — Build images and deploy to Docker Desktop Kubernetes
#
# Usage:
#   ./deploy-local.sh          # build both + deploy
#   ./deploy-local.sh backend  # rebuild only backend + redeploy
#   ./deploy-local.sh frontend # rebuild only frontend + redeploy

set -euo pipefail

# Always resolve paths relative to this script, not the caller's cwd
cd "$(dirname "$0")"

# Disable Git Bash / MSYS path conversion so values like /api are passed
# to Docker as-is instead of being expanded to C:/Program Files/Git/api
export MSYS_NO_PATHCONV=1

BACKEND_IMAGE="chesslink/backend:local"
FRONTEND_IMAGE="chesslink/frontend:local"
NAMESPACE="chesslink"
TARGET="${1:-all}"

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }

# -----------------------------------------------------------------------
# Sanity checks
# -----------------------------------------------------------------------
if ! kubectl config get-contexts | grep -q "docker-desktop"; then
  warn "docker-desktop context not found. Available contexts:"
  kubectl config get-contexts
  exit 1
fi

kubectl config use-context docker-desktop
log "Using context: docker-desktop"

# -----------------------------------------------------------------------
# Build images
# -----------------------------------------------------------------------
build_backend() {
  log "Building backend image..."
  docker build -t "$BACKEND_IMAGE" ./backend
  log "Backend image built: $BACKEND_IMAGE"
}

build_frontend() {
  log "Building frontend image..."
  docker build \
    --build-arg VITE_API_URL=/api \
    -t "$FRONTEND_IMAGE" \
    ./frontend
  log "Frontend image built: $FRONTEND_IMAGE"
}

case "$TARGET" in
  backend)  build_backend  ;;
  frontend) build_frontend ;;
  all)
    build_backend
    build_frontend
    ;;
esac

# -----------------------------------------------------------------------
# Apply manifests
# -----------------------------------------------------------------------
log "Applying Kubernetes manifests..."
kubectl apply -f k8s-local/namespace.yaml
kubectl apply -f k8s-local/mongodb.yaml
kubectl apply -f k8s-local/backend.yaml
kubectl apply -f k8s-local/frontend.yaml

# -----------------------------------------------------------------------
# Rolling restart so k8s picks up the new :local image
# (imagePullPolicy: Never means k8s won't re-pull, but a rollout restart
#  forces it to re-create the pod with the freshly built local image)
# -----------------------------------------------------------------------
case "$TARGET" in
  backend)
    log "Restarting backend..."
    kubectl rollout restart deployment/backend -n "$NAMESPACE"
    kubectl rollout status deployment/backend  -n "$NAMESPACE" --timeout=60s
    ;;
  frontend)
    log "Restarting frontend..."
    kubectl rollout restart deployment/frontend -n "$NAMESPACE"
    kubectl rollout status deployment/frontend  -n "$NAMESPACE" --timeout=60s
    ;;
  all)
    log "Waiting for rollouts..."
    kubectl rollout restart deployment/mongodb  -n "$NAMESPACE"
    kubectl rollout restart deployment/backend  -n "$NAMESPACE"
    kubectl rollout restart deployment/frontend -n "$NAMESPACE"
    kubectl rollout status deployment/mongodb   -n "$NAMESPACE" --timeout=60s
    kubectl rollout status deployment/backend   -n "$NAMESPACE" --timeout=60s
    kubectl rollout status deployment/frontend  -n "$NAMESPACE" --timeout=60s
    ;;
esac

# -----------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------
log "Deployment complete!"
echo ""
echo "  App:     http://localhost:30080"
echo "  API:     http://localhost:30080/api"
echo "  WS:      ws://localhost:30080/ws"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -n $NAMESPACE deploy/backend -f"
echo "  kubectl logs -n $NAMESPACE deploy/frontend -f"