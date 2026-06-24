# Napat Skills

Personal Codex skills by Napat.

This repository is designed as a collection of installable Codex skills. The first skill is `go-service-builder`, a skill for creating Go service and Kustomize project skeletons with pinned runtime versions and production-oriented conventions.

The recommended GitHub layout is one repository named `Napat/skills`, with each skill stored as a top-level folder. Future skills can be added beside `go-service-builder/` without changing the installation style.

## What Is In This Repo

```text
skills/
├── README.md
├── LICENSE
├── .gitignore
├── scripts/
│   └── validate_skill.py
└── go-service-builder/
    ├── SKILL.md
    ├── agents/
    │   └── openai.yaml
    ├── references/
    │   ├── archetypes.md
    │   ├── code-patterns.md
    │   ├── kustomize-patterns.md
    │   ├── usage-guide.md
    │   └── version-policy.md
    └── scripts/
        └── resolve_versions.py
```

## Skill: go-service-builder

`go-service-builder` helps Codex create or update:

- Go service repositories
- Kustomize deployment repositories
- Code-only, Kustomize-only, or combined code plus Kustomize work
- HTTP API services, orchestration services, adaptor services, Kafka/message consumers, and scheduled batch jobs

The skill is generic. It does not assume a private Git host, company-specific package, internal standard library, or private container registry unless you explicitly provide one.

Key behavior:

- Pins Go, Alpine, and Docker image versions instead of using `latest`
- Uses Alpine-based images by default
- Uses port `80` consistently across app, Docker, Kustomize, Service, and probes
- Defaults timezone to `Asia/Bangkok` but asks the user to confirm it before generating files
- Uses Kustomize `patches`, not deprecated `patchesStrategicMerge`
- Keeps production secrets as placeholders

## Prerequisites

Install these tools before using the skill:

- Codex
- Git
- Python 3.10 or newer
- Go, if you want to build or test generated Go services
- Docker, if you want to build generated Dockerfiles
- Kustomize, if you want to validate generated Kubernetes manifests

The bundled version resolver uses only Python standard library modules.

## Install The Skill

First create the GitHub repository if it does not exist yet:

1. Open GitHub.
2. Create a new repository under `Napat`.
3. Name it `skills`.
4. Do not add a README, license, or `.gitignore` in the GitHub UI if you plan to push this local folder, because those files already exist here.

Clone this repository on another machine, or after it has been pushed:

```bash
git clone https://github.com/Napat/skills.git
cd skills
```

Create your local Codex skills directory if it does not exist:

```bash
mkdir -p ~/.codex/skills
```

Copy the skill into Codex:

```bash
cp -R go-service-builder ~/.codex/skills/
```

Confirm the skill exists:

```bash
ls ~/.codex/skills/go-service-builder
```

You should see `SKILL.md`, `agents/`, `references/`, and `scripts/`.

## Validate The Skill

Run the lightweight validator included in this repo:

```bash
python3 scripts/validate_skill.py go-service-builder
```

Expected output:

```text
OK: go-service-builder
```

Then test the version resolver:

```bash
python3 go-service-builder/scripts/resolve_versions.py
```

Expected output is JSON similar to:

```json
{
  "go": {
    "module_go": "1.xx",
    "version": "1.xx.x"
  },
  "images": {
    "builder": {
      "image": "golang:1.xx.x-alpine3.xx"
    },
    "runtime": {
      "image": "alpine:3.xx"
    }
  }
}
```

The exact versions change over time because the script checks official sources.

## Use The Skill In Codex

Restart Codex after installing the skill so it can be discovered.

Then ask Codex with a prompt like this:

```text
Use go-service-builder to create a code-only Go core service named payment-quote.
Module path is github.com/acme/payment-quote.
It has POST /payment-quote/api/v1/create-quote and uses Redis.
Use Asia/Bangkok timezone.
```

Create Kustomize only:

```text
Use go-service-builder to create kustomize-only manifests for a consumer service named transaction-history-consumer.
It exposes /health and /ready on port 80 and consumes Kafka topic transaction.history.v1.
Environments are sit, uat, prd.
Use Asia/Bangkok timezone.
```

Create both code and Kustomize:

```text
Use go-service-builder to create both code and kustomize repos for an adaptor service named adaptor-bank-transfer.
Module path is github.com/acme/adaptor-bank-transfer.
It exposes POST /adaptor-bank-transfer/api/v1/transfer, calls an external bank API, caches access tokens in Redis, and targets sit/uat/prd.
Use Asia/Bangkok timezone.
```

Create a batch job:

```text
Use go-service-builder to create a batch job named batch-daily-settlement.
Module path is github.com/acme/batch-daily-settlement.
It runs every day at 17:01 Asia/Bangkok, reads MySQL, writes a report, and deploys as a CronJob.
```

## What To Tell Codex

For best results, provide:

- Service name, such as `core-order-detail`
- Scope: `code`, `kustomize`, or `both`
- Archetype: `core`, `orch`, `adaptor`, `consumer`, or `batch`
- Go module path, such as `github.com/org/service-name`
- HTTP routes, Kafka topics, or cron schedule
- Dependencies, such as MySQL, Redis, Kafka, external HTTP, or SFTP
- Target environments, usually `sit`, `uat`, `prd`
- Container registry path, if Kustomize should use a real registry
- Timezone confirmation, usually `Asia/Bangkok`

## Update An Existing Installation

After pulling the newest version:

```bash
git pull
rm -rf ~/.codex/skills/go-service-builder
cp -R go-service-builder ~/.codex/skills/
```

Restart Codex after updating.

## Develop This Skill

Edit files under `go-service-builder/`.

After changes, run:

```bash
python3 scripts/validate_skill.py go-service-builder
python3 go-service-builder/scripts/resolve_versions.py
```

Generated Python caches are ignored by `.gitignore`.

## Publish To GitHub

If this folder is not a Git repository yet:

```bash
git init
git branch -M main
git remote add origin https://github.com/Napat/skills.git
```

Commit and push:

```bash
git add .
git commit -m "Add go service builder skill"
git push -u origin main
```

If the remote already exists, use:

```bash
git remote -v
git push
```

## Notes

This repository intentionally keeps documentation for humans in the repository root. The skill folder itself contains only files Codex needs to use the skill.
