terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "chesslink-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Artifact Registry — stores Docker images
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "chesslink" {
  location      = var.region
  repository_id = "chesslink"
  format        = "DOCKER"
  description   = "ChessLink Docker images"
}

# ---------------------------------------------------------------------------
# GKE Autopilot cluster
# ---------------------------------------------------------------------------
resource "google_container_cluster" "chesslink" {
  name     = var.cluster_name
  location = var.region

  enable_autopilot = true

  release_channel {
    channel = "REGULAR"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  ip_allocation_policy {}

  deletion_protection = false
}

# ---------------------------------------------------------------------------
# Service account for GitHub Actions
# ---------------------------------------------------------------------------
resource "google_service_account" "github_actions" {
  account_id   = "github-actions"
  display_name = "GitHub Actions"
  description  = "Used by GitHub Actions to deploy to GKE and push to Artifact Registry"
}

resource "google_project_iam_member" "github_actions_owner" {
  project = var.project_id
  role    = "roles/owner"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "compute_artifactregistry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${data.google_compute_default_service_account.default.email}"
}

data "google_compute_default_service_account" "default" {
  project = var.project_id
}

# ---------------------------------------------------------------------------
# Workload Identity Federation
# ---------------------------------------------------------------------------
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}'"
}

resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "workload_identity_provider" {
  description = "Value for GCP_WORKLOAD_IDENTITY_PROVIDER GitHub secret"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "Value for GCP_SERVICE_ACCOUNT GitHub secret"
  value       = google_service_account.github_actions.email
}

output "artifact_registry_url" {
  description = "Base URL for Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/chesslink"
}

output "cluster_name" {
  value = google_container_cluster.chesslink.name
}
