# Archetypes

Choose one archetype per service. Keep names and packages generic.

## Core

Use for services that own business logic or domain data. Typical behavior:

- Expose HTTP routes under `/<service-name>/api/v1`.
- Include `/health` and `/ready`.
- Validate request bodies with `go-playground/validator`.
- Keep domain rules in `internal/service`.
- Use `internal/repository` for DB, Redis, or other persistence.
- Define request/response DTOs in `internal/model`.
- Add interfaces before concrete implementations to support gomock tests.

Common packages:

```text
app/internal/handler/httphandler
app/internal/service
app/internal/repository
app/internal/model
app/internal/config
```

## Orch

Use for services that compose data or workflows across downstream services. Typical behavior:

- Expose HTTP routes under `/<service-name>/api/v1`.
- Authenticate or read user/session headers when required by the spec.
- Use outbound HTTP clients in repository packages.
- Configure each downstream endpoint with retry and timeout settings.
- Keep orchestration decisions in `internal/service`; keep HTTP request details in `internal/repository`.
- Mock downstream repositories in service tests.

Recommended config shape:

```yaml
services:
  downstream-a:
    action-name:
      endpoint: http://example/api/v1/action
      retry: 1
      retry-wait-time: 100ms
      retry-max-wait-time: 1s
      max-connections-per-host: 100
      max-idle-connections: 100
      max-idle-connections-per-host: 100
      idle-connection-timeout: 90s
      request-timeout: 10s
      tls-handshake-timeout: 5s
      dial-timeout: 5s
      response-header-timeout: 5s
```

## Adaptor

Use for services that wrap external systems. Typical behavior:

- Expose HTTP routes under `/<service-name>/api/v1`.
- Keep external API protocol details in `internal/repository/externalservice`.
- Use `internal/service` for token refresh, fallback, response mapping, and business-facing errors.
- Use Redis or in-memory cache for access tokens when needed.
- Add certificate/newline normalization only when user-supplied secrets require it.
- Avoid leaking external credentials in logs.

Common packages:

```text
app/internal/router
app/internal/handler
app/internal/service
app/internal/repository
app/internal/repository/externalservice
app/internal/model
app/internal/config
```

## Consumer

Use for Kafka or message consumers. Typical behavior:

- Start the consumer in `main.go`.
- Expose `/health` and `/ready` for Kubernetes.
- Put message handling in `internal/handler/<transport>handler`.
- Keep business behavior in `internal/service`.
- Keep DB writes or outbound calls in `internal/repository`.
- Validate deserialized messages before processing.
- Mark/commit messages only after successful handling when the selected client requires explicit commits.

Common packages:

```text
app/internal/handler/httphandler
app/internal/handler/kafkahandler
app/internal/service
app/internal/repository
app/internal/model
app/pkg/kafka
```

## Batch

Use for one-shot jobs that run on demand or by CronJob. Typical behavior:

- Load config and secrets.
- Initialize dependencies.
- Run one handler/service flow.
- Return success/failure through process exit or a `done` channel.
- Recover panics, log failure, and exit non-zero when appropriate.
- Deploy as Kubernetes `CronJob`, not `Deployment`.

Common packages:

```text
app/cmd
app/internal/config
app/internal/handler
app/internal/service
app/internal/repository
app/internal/model
```

## Naming

Use kebab-case for service folders and Kubernetes resources. Use Go package names without hyphens:

- Service name: `core-order-detail`
- Package stem: `orderdetail` or `coreorderdetail`
- Type names: `OrderDetailService`, `OrderDetailHandler`
- Route prefix: `/core-order-detail/api/v1`

Ask the user before inventing non-obvious domain names.
