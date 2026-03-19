# ArgoCD Setup Guide

## 1. Install ArgoCD into the cluster

```bash
# Create the argocd namespace
kubectl create namespace argocd

# Install ArgoCD (stable release)
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready (takes ~2 minutes)
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

---

## 2. Access the ArgoCD UI

ArgoCD runs inside the cluster. To access it locally:

```bash
# Port-forward the ArgoCD server to your local machine
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Then open https://localhost:8080 in your browser (accept the self-signed cert warning).

---

## 3. Get the initial admin password

```bash
# The initial password is auto-generated and stored in a secret
kubectl get secret argocd-initial-admin-secret \
  -n argocd \
  -o jsonpath="{.data.password}" | base64 --decode && echo

# Login with:
# Username: admin
# Password: <output from above>
```

Change the password immediately after first login via the UI:
User Info (top right) → Update Password

---

## 4. Install the ArgoCD CLI (optional but useful)

```bash
# macOS
brew install argocd

# Linux
curl -sSL -o /usr/local/bin/argocd \
  https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# Login via CLI
argocd login localhost:8080 --username admin --password <your-password> --insecure
```

---

## 5. Connect your Git repository

If your repo is private, ArgoCD needs credentials to pull from it.

```bash
# Using a GitHub Personal Access Token (PAT)
# Create one at: GitHub → Settings → Developer Settings → Personal Access Tokens
argocd repo add https://github.com/<YOUR_ORG>/chesslink.git \
  --username <YOUR_GITHUB_USERNAME> \
  --password <YOUR_GITHUB_PAT>
```

If your repo is public, skip this step.

---

## 6. Apply the Application manifest

```bash
# This tells ArgoCD what to deploy and where
kubectl apply -f argocd/application.yaml

# Check the sync status
argocd app get chesslink

# Manually trigger a sync (first time)
argocd app sync chesslink
```

---

## 7. Verify the deployment

```bash
# Watch pods come up in the chesslink namespace
kubectl get pods -n chesslink -w

# Check the ArgoCD app status
argocd app list
```

---

## How the GitOps flow works after this

1. CI (GitHub Actions) builds a new image and pushes it to ECR with a new tag (commit SHA)
2. CI updates `backend.image.tag` or `frontend.image.tag` in the values file and commits it
3. ArgoCD detects the Git change within ~3 minutes (default poll interval)
4. ArgoCD syncs the cluster — rolling update with zero downtime
5. If anything goes wrong, revert the Git commit and ArgoCD will roll back automatically

---

## Useful ArgoCD CLI commands

```bash
# List all apps
argocd app list

# Get detailed status of chesslink
argocd app get chesslink

# Force a manual sync
argocd app sync chesslink

# Roll back to a previous version
argocd app rollback chesslink <revision-number>

# View sync history
argocd app history chesslink
```