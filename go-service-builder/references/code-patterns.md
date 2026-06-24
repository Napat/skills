# Code Patterns

Use these patterns for generated Go repositories.

## Required Project Files

```text
go.mod
Makefile
Dockerfile
.gitignore
config/config.yaml
config/secret.env
app/cmd/main.go
app/internal/config/config.go
app/internal/model
app/internal/handler
app/internal/service
```

Add `app/internal/repository` only when the service has persistence, cache, outbound HTTP, or external systems.

## Module Path

Use the module path supplied by the user. If not supplied, ask for it. Do not assume any private Git host or company namespace.

```go
module github.com/example/service-name
```

## Configuration

Use `config/config.yaml` for non-secret configuration and `config/secret.env` for secret placeholders. Prefer struct tags compatible with `mapstructure`, `envconfig`, and `validator`.

Base config:

```go
type AppConfig struct {
    Log     Log     `mapstructure:"log" validate:"required"`
    App     App     `mapstructure:"app" validate:"required"`
    Server  Server  `mapstructure:"server" validate:"required"`
    Secrets Secrets `mapstructure:"secrets" validate:"required"`
}

type Log struct {
    Level string `mapstructure:"level" validate:"required"`
    Env   string `mapstructure:"env" validate:"required"`
}

type App struct {
    Name      string `mapstructure:"name" validate:"required"`
    ProjectID string `mapstructure:"project-id"`
}

type Server struct {
    Address      string        `mapstructure:"address" validate:"required"`
    TimeZone     string        `mapstructure:"time-zone" validate:"required"`
    ReadTimeout  time.Duration `mapstructure:"read-timeout" validate:"required"`
    WriteTimeout time.Duration `mapstructure:"write-timeout" validate:"required"`
    IdleTimeout  time.Duration `mapstructure:"idle-timeout" validate:"required"`
}
```

Use `time.Duration` values in YAML such as `10s`, `1m`, or `100ms`.

## Main Flow

For long-running services:

1. Create root context.
2. Load config and secrets.
3. Validate config.
4. Set timezone.
5. Initialize logger/tracing if selected dependencies are present.
6. Initialize repositories, services, handlers.
7. Start HTTP server or consumer.
8. Handle graceful shutdown on `SIGHUP`, `SIGINT`, `SIGQUIT`, and `SIGTERM`.

For batch services:

1. Load config and secrets.
2. Validate config.
3. Initialize dependencies.
4. Run one handler/service action.
5. Log result and exit.

## HTTP Handlers

Handlers should:

- Bind request bodies into `internal/model` structs.
- Validate input with `validator.Struct`.
- Call service interfaces, not concrete services.
- Return a consistent response envelope unless the user supplies another API contract.
- Log errors without printing secrets.

Generic response envelope:

```go
type APIResponse[T any] struct {
    Code      int    `json:"code"`
    Message   string `json:"message"`
    Data      T      `json:"data,omitempty"`
    ErrorData any    `json:"error_data,omitempty"`
}
```

## Service Layer

Services should:

- Own business rules.
- Depend on repository interfaces.
- Return typed responses and errors.
- Keep side effects behind injected dependencies.
- Be easy to test with gomock.

## Repository Layer

Repositories should:

- Own storage, cache, outbound HTTP, and external system details.
- Receive `context.Context`.
- Keep retry/timeout behavior in HTTP client config.
- Map external responses into internal model types.
- Avoid business decisions beyond protocol mapping.

## Testing

Prefer this testing stack:

- `go test ./...`
- `go.uber.org/mock/gomock` for interfaces
- `github.com/stretchr/testify/suite` or plain table tests
- `github.com/DATA-DOG/go-sqlmock` for SQL
- `github.com/jarcoal/httpmock` or `httptest` for outbound HTTP

Add `go:generate` comments beside interfaces that need mocks:

```go
//go:generate mockgen -source=./service.go -destination=./mock_service/service.go -package=mock_service
type IService interface {
    Execute(ctx context.Context, req *Request) (*Response, error)
}
```

## Makefile

Include these targets when useful:

```makefile
.PHONY: run tidy test gogen gosec govulncheck security help

run:
	APPENV=local go run -race app/cmd/main.go

tidy:
	go mod tidy

test:
	go clean -testcache
	go test -v -race ./...

gogen:
	go generate ./...

gosec:
	gosec ./...

govulncheck:
	govulncheck ./...

security: gosec govulncheck
```

## Dockerfile

Use pinned versions resolved from official sources. Prefer multi-stage builds and a small Alpine runtime:

```dockerfile
FROM golang:<pin>-alpine<alpine-pin> AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY ./app ./app
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o main ./app/cmd/main.go

FROM alpine:<alpine-pin>

WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Bangkok
COPY --from=builder /app/main .
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' /app/main && \
    apk del libcap && \
    adduser -D -u 1000 nonroot
USER nonroot
ENTRYPOINT ["./main"]
```

Default generated services use port `80` consistently across app config, Docker, Deployment, Service, and probes. Keep `libcap`/`setcap` when running as non-root on port `80`. If the user explicitly chooses a non-privileged port such as `8080`, omit `libcap`/`setcap`.

Do not install `libc6-compat` by default. Add native compatibility packages only when the user confirms the service needs CGO or native libraries.

## Private Dependencies

Do not add private repositories, company standard libraries, or private proxies unless the user explicitly supplies them. If a project requires private packages, ask for:

- module import path
- version or branch
- GOPRIVATE pattern
- proxy/checksum policy
