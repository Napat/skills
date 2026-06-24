# Usage Guide

Use `go-service-builder` when creating new Go service projects or matching Kustomize deployment projects. The skill supports code-only, kustomize-only, and combined generation.

## Quick Prompts

Create code only:

```text
Use go-service-builder to create a code-only Go core service named payment-quote. Module path is github.com/acme/payment-quote. It has POST /payment-quote/api/v1/create-quote and uses Redis.
```

Create Kustomize only:

```text
Use go-service-builder to create kustomize-only manifests for a consumer service named transaction-history-consumer. It exposes /health and /ready on port 80 and consumes Kafka topic transaction.history.v1. Environments are sit, uat, prd.
```

Create both:

```text
Use go-service-builder to create both code and kustomize repos for an adaptor service named adaptor-bank-transfer. Module path is github.com/acme/adaptor-bank-transfer. It exposes POST /adaptor-bank-transfer/api/v1/transfer, calls an external bank API, caches access tokens in Redis, and targets sit/uat/prd.
```

Create a batch:

```text
Use go-service-builder to create a batch job named batch-daily-settlement. Module path is github.com/acme/batch-daily-settlement. It runs every day at 17:01 Asia/Bangkok, reads MySQL, writes a report, and deploys as a CronJob.
```

## Information To Provide

Provide these values for best results:

- Service name in kebab-case, such as `core-order-detail`.
- Scope: `code`, `kustomize`, or `both`.
- Archetype: `core`, `orch`, `adaptor`, `consumer`, or `batch`.
- Module path for code generation, such as `github.com/org/service-name`.
- Runtime dependencies: MySQL/Postgres/Redis/Kafka/external HTTP/SFTP/etc.
- HTTP routes, Kafka topics, or batch schedule.
- Target environments, usually `sit`, `uat`, `prd`.
- Timezone. Default is `Asia/Bangkok`; confirm it before generating files.
- Container registry path if Kustomize should reference a real registry.
- Whether `.gitlab-ci.yml` or another CI file should be generated.

## Generated Code Shape

Code projects use:

```text
app/
  cmd/main.go
  internal/
    config/
    handler/
    model/
    repository/
    service/
config/
  config.yaml
  secret.env
Dockerfile
Makefile
go.mod
```

Long-running HTTP services expose `/health`; add `/ready` unless the user requests otherwise. Consumers also expose health/readiness for Kubernetes probes. Batch jobs are one-shot programs and should exit success/failure.

## Generated Kustomize Shape

Kustomize projects use separate base and overlays:

```text
base/
  configs/config.env
  configs/config.yaml
  secrets/secret.env
  resources/deployment.yaml
  resources/service.yaml
  kustomization.yaml
overlays/
  sit/
  uat/
  prd/
```

Batch projects replace `deployment.yaml` and `service.yaml` with `cronjob.yaml` unless the user wants a service too.

## Version Behavior

The skill must check official sources at generation time and pin versions. It must not put `latest` in committed files. Use explicit versions such as `go 1.xx`, `FROM golang:1.xx.x-alpine3.yy`, and `FROM alpine:3.yy`.

## Secret Behavior

Production secrets must be placeholders. Good examples:

```dotenv
SECRET_DATABASE_HOST=DATABASE_PROD_HOST
SECRET_DATABASE_PASSWORD=DATABASE_PROD_PASSWORD
SECRET_KAFKA_TLS_CERT=KAFKA_PROD_TLS_CERT
```

SIT/UAT may use concrete values only when supplied by the user. Otherwise use placeholders there too.

## Follow-Up Prompts

Useful follow-up requests:

```text
Add a repository and sqlmock test for the MySQL insert path.
```

```text
Generate kustomize overlays only for this existing Go service.
```

```text
Update the Dockerfile to the current official pinned Go and Alpine versions.
```

```text
Add Kafka consumer config and a handler test.
```
