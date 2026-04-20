#!/bin/bash
# bootstrap-gcp.sh
# Run this ONCE from GCP Cloud Shell to provision everything.
# After this, all future infra changes go through the GitHub Actions workflow.

set -euo pipefail

PROJECT_ID="project-92bb6bf3-4468-4f91-830"
REGION="europe-north1"
BUCKET="chesslink-tfstate"

echo "=== Step 1: Create GCS state bucket ==="
if gsutil ls gs://${BUCKET} &>/dev/null; then
  echo "✅ Bucket already exists"
else
  gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${BUCKET}
  gsutil versioning set on gs://${BUCKET}
  echo "✅ Bucket created"
fi

echo ""
echo "=== Step 2: Terraform init + apply ==="
cd terraform/gcp
terraform init
terraform apply -auto-approve

echo ""
echo "=== Step 3: Outputs — add these as GitHub secrets ==="
echo ""
echo "GCP_PROJECT_ID (GitHub Variable):"
echo "  ${PROJECT_ID}"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER (GitHub Secret):"
terraform output -raw workload_identity_provider
echo ""
echo ""
echo "GCP_SERVICE_ACCOUNT (GitHub Secret):"
terraform output -raw service_account_email
echo ""
echo ""
echo "ARTIFACT_REGISTRY_URL (GitHub Variable):"
terraform output -raw artifact_registry_url
echo ""
echo ""
echo "✅ Bootstrap complete! Add the above values to your GitHub repo secrets/variables."
echo "   Settings → Secrets and variables → Actions"