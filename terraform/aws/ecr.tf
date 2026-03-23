locals {
  ecr_repos = ["backend", "frontend"]
}

resource "aws_ecr_repository" "services" {
  for_each = toset(local.ecr_repos)

  name                 = "${var.cluster_name}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.cluster_name}-${each.key}"
  }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = toset(local.ecr_repos)
  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
