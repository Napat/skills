---
name: go-service-builder
description: Build or update production-oriented Go service repositories and matching Kustomize deployment repositories from observed layered service patterns. Use when Codex is asked to scaffold or extend a Go project, HTTP API service, outbound adaptor service, orchestration service, batch job, Kafka/message consumer, or Kubernetes/Kustomize manifests. Supports code-only, kustomize-only, and combined code plus kustomize work. Emphasizes pinned current official versions, small Docker images, generic module paths, testable interfaces, and environment-safe secret handling.
---

# Go Service Builder

Use this skill to create or modify a Go service project and/or a separate Kustomize project. Keep generated projects generic: do not assume any company-specific namespace, private Git host, private module, or internal platform dependency unless the user explicitly supplies it.

## Start Here

Determine the requested scope:

- `code`: create or update only the Go service repository.
- `kustomize`: create or update only the Kustomize repository.
- `both`: create or update separate code and Kustomize repositories.

Determine the service archetype:

- `core`: domain/business HTTP API with optional DB/Redis.
- `orch`: orchestration HTTP API that calls multiple downstream services.
- `adaptor`: HTTP API wrapping an external system, often with auth/token caching.
- `consumer`: Kafka/message consumer with health/readiness HTTP endpoints.
- `batch`: one-shot scheduled job intended for Kubernetes CronJob.

If the user has not supplied enough detail, ask only for missing values that affect file names or architecture: service name, module path, scope, archetype, endpoints or topic/schedule, dependencies, target environments, and timezone. Default timezone is `Asia/Bangkok`; ask the user to confirm it before generating new files.

## Version Rules

Before generating files that contain Go or container image versions, read [version-policy.md](references/version-policy.md) and run this skill's bundled `scripts/resolve_versions.py`.

Never write floating `latest` tags into committed Dockerfiles, `go.mod`, Kustomize images, or Kubernetes manifests. Resolve and pin the newest stable official version available at generation time. Prefer small images: use Alpine-based runtime images first when compatible with the service.

## Reference Loading

Load only the reference files needed for the task:

- Read [usage-guide.md](references/usage-guide.md) when the user asks how to use the skill or wants examples.
- Read [archetypes.md](references/archetypes.md) when choosing package layout or layer-specific behavior.
- Read [code-patterns.md](references/code-patterns.md) when creating or editing Go code.
- Read [kustomize-patterns.md](references/kustomize-patterns.md) when creating or editing Kustomize manifests.
- Read [version-policy.md](references/version-policy.md) when generating `go.mod`, Dockerfiles, or container image tags.

## Workflow

1. Inspect the target workspace and identify whether code, kustomize, or both already exist.
2. Confirm the service spec from user input and local context.
3. Resolve current pinned versions from official sources with this skill's bundled `scripts/resolve_versions.py` before writing versioned files.
4. Generate the smallest useful project surface for the selected scope and archetype.
5. Keep code and Kustomize repos separable. Do not require one side unless the user requested both.
6. Add tests or test scaffolding proportional to generated behavior.
7. Run formatting and validation that are available locally.

## Output Expectations

For code projects, produce a buildable Go module with:

- `app/cmd/main.go`
- `app/internal/config`
- `app/internal/handler`
- `app/internal/service`
- `app/internal/repository` when external storage or downstream systems exist
- `app/internal/model`
- `config/config.yaml`
- `config/secret.env` with placeholders only
- `Dockerfile`, `Makefile`, `.gitignore`, and optional `.gitlab-ci.yml` when requested

For Kustomize projects, produce:

- `base/kustomization.yaml`
- `base/configs/config.env`
- `base/configs/config.yaml`
- `base/secrets/secret.env`
- `base/resources/deployment.yaml` and `service.yaml` for long-running services
- `base/resources/cronjob.yaml` for batch services
- `overlays/sit`, `overlays/uat`, and `overlays/prd` unless the user requests different environments
- `overlays/*/patches/set_resources.yaml`

Use production-safe secret behavior:

- `prd` secrets must always be placeholders, secret-manager keys, or CI/CD variable references.
- `sit` and `uat` may contain concrete values only when the user explicitly provides them.
- Never copy secrets from example repositories into new output.

## Validation

Prefer these checks when available:

```bash
gofmt -w ./app
go mod tidy
go test ./...
docker build .
kustomize build overlays/sit
kustomize build overlays/uat
kustomize build overlays/prd
```

If a command cannot run because dependencies, network, credentials, or tools are unavailable, state the blocker and still inspect generated files for structural consistency.
