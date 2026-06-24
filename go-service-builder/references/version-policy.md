# Version Policy

Use this reference whenever generating `go.mod`, Dockerfiles, or Kubernetes image tags.

## Core Rule

Resolve and pin current stable official versions at generation time. Do not write floating `latest` tags into committed project files.

Allowed exception: `latest` may be used only in throwaway local commands or temporary exploratory notes that are not committed into generated project files.

## Official Sources

Run this skill's bundled resolver before writing versioned files. Execute it from the skill directory, or pass the absolute path to the script:

```bash
python3 scripts/resolve_versions.py
```

The script returns JSON with Go, Alpine, and recommended Docker image pins. If the script fails, check these sources manually before writing versioned files:

- Go stable releases: `https://go.dev/dl/`
- Go official Docker image tags: `https://hub.docker.com/_/golang`
- Alpine release branches: `https://www.alpinelinux.org/releases/`
- Other runtime images: official vendor image pages or OCI registry metadata when available.

If browsing or network access is unavailable, ask the user for the version or use a locally installed version only after saying it may not be the newest official release.

## Go Version

Use the newest stable Go release from `go.dev/dl/`. Ignore release candidates such as `rc`, `beta`, or `tip` unless the user explicitly asks for pre-release builds.

In `go.mod`, use the major/minor Go language version accepted by Go modules:

```go
go 1.<minor>
```

In Dockerfiles, use a fully pinned patch image when available:

```dockerfile
FROM golang:<go-patch>-alpine<alpine-minor> AS builder
```

If the exact Alpine variant for the newest Go patch is unavailable, use the newest stable `golang:<go-patch>-alpine<supported-alpine>` tag listed by the official image.

## Alpine Version

Use the newest stable Alpine branch from the official releases page that is supported by the required `golang` Docker tag.

Prefer:

```dockerfile
FROM alpine:<alpine-minor>
```

Do not use `alpine:latest` in generated Dockerfiles.

## Runtime Image Preference

Prefer small runtime images:

1. `alpine:<pin>` when CGO/native library behavior is compatible.
2. Distroless or scratch only when the service does not need shell, tzdata, CA cert package installation, or operational debugging.
3. Debian slim only when Alpine/musl is incompatible with dependencies.

For Go services built with `CGO_ENABLED=0`, Alpine runtime is the default choice.

## Image Tags In Kustomize

In `base`, use a placeholder tag:

```yaml
image: <registry>/<service-name>:TAG
```

In overlays, use a concrete tag supplied by the user, a commit SHA, or a pinned semantic version:

```yaml
newTag: 1.4.2
```

or:

```yaml
newTag: 86957ede
```

Never generate:

```yaml
newTag: latest
```

## Private Base Images

Use private base images only if the user explicitly supplies the image name and version. If they give a private image without a version, ask for a pinned tag.

## Documentation

When reporting generated versions to the user, include the source used and the date checked.
