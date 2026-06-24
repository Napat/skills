# Kustomize Patterns

Use this reference when generating Kubernetes/Kustomize repositories.

## Repository Shape

```text
base/
  kustomization.yaml
  configs/
    config.env
    config.yaml
  secrets/
    secret.env
  resources/
    deployment.yaml
    service.yaml
overlays/
  sit/
    kustomization.yaml
    configs/config.env
    configs/config.yaml
    secrets/secret.env
    patches/set_resources.yaml
  uat/
  prd/
```

For batch jobs:

```text
base/resources/cronjob.yaml
overlays/<env>/patches/set_resources.yaml
```

Do not generate a `Service` for batch jobs unless the user explicitly wants one.

## Base Kustomization

Long-running service:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - resources/deployment.yaml
  - resources/service.yaml

configMapGenerator:
  - name: <service-name>-configmap-file
    files:
      - configs/config.yaml
  - name: <service-name>-configmap-env
    envs:
      - configs/config.env

secretGenerator:
  - name: <service-name>-secret-env
    envs:
      - secrets/secret.env
```

Batch:

```yaml
resources:
  - resources/cronjob.yaml
```

Keep generator names stable because deployments reference them directly.

## Deployment

Use explicit labels and a placeholder image tag in base:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <service-name>
  labels:
    app.kubernetes.io/name: <service-name>
    app.kubernetes.io/instance: <service-name>
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: <service-name>
      app.kubernetes.io/instance: <service-name>
  template:
    metadata:
      labels:
        app.kubernetes.io/name: <service-name>
        app.kubernetes.io/instance: <service-name>
    spec:
      containers:
        - name: <service-name>
          image: <registry>/<service-name>:TAG
          imagePullPolicy: IfNotPresent
          volumeMounts:
            - mountPath: /app/config/config.yaml
              name: <service-name>-configmap-file
              subPath: config.yaml
          envFrom:
            - configMapRef:
                name: <service-name>-configmap-env
            - secretRef:
                name: <service-name>-secret-env
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
          readinessProbe:
            httpGet:
              path: /ready
              port: http
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 50m
              memory: 64Mi
      volumes:
        - name: <service-name>-configmap-file
          configMap:
            name: <service-name>-configmap-file
```

If the service exposes only `/health`, use `/health` for readiness too.

## Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <service-name>
  labels:
    app.kubernetes.io/name: <service-name>
    app.kubernetes.io/instance: <service-name>
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: <service-name>
    app.kubernetes.io/instance: <service-name>
```

## CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: <service-name>
spec:
  failedJobsHistoryLimit: 3
  successfulJobsHistoryLimit: 1
  concurrencyPolicy: Forbid
  schedule: "<cron-expression>"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: <service-name>
              image: <registry>/<service-name>:TAG
              imagePullPolicy: IfNotPresent
              volumeMounts:
                - mountPath: /app/config/config.yaml
                  name: <service-name>-configmap-file
                  subPath: config.yaml
              envFrom:
                - configMapRef:
                    name: <service-name>-configmap-env
                - secretRef:
                    name: <service-name>-secret-env
              resources:
                limits:
                  cpu: 250m
                  memory: 128Mi
                requests:
                  cpu: 125m
                  memory: 64Mi
          volumes:
            - name: <service-name>-configmap-file
              configMap:
                name: <service-name>-configmap-file
```

## Overlay Kustomization

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

images:
  - name: <registry>/<service-name>
    newName: <registry>/<service-name>
    newTag: <pinned-image-tag-or-commit-sha>

configMapGenerator:
  - behavior: merge
    envs:
      - configs/config.env
    name: <service-name>-configmap-env
  - behavior: merge
    files:
      - configs/config.yaml
    name: <service-name>-configmap-file

secretGenerator:
  - behavior: merge
    envs:
      - secrets/secret.env
    name: <service-name>-secret-env

patches:
  - path: patches/set_resources.yaml
    target:
      kind: <Deployment-or-CronJob>
      name: <service-name>
```

## Resource Patch

Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <service-name>
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: <service-name>
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 50m
              memory: 64Mi
```

CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: <service-name>
spec:
  schedule: "<cron-expression>"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: <service-name>
              resources:
                limits:
                  cpu: 250m
                  memory: 128Mi
                requests:
                  cpu: 125m
                  memory: 64Mi
```

## Secret Rules

Never copy secrets from existing repositories.

`prd/secrets/secret.env` must contain placeholders only:

```dotenv
SECRET_DATABASE_HOST=DATABASE_PROD_HOST
SECRET_DATABASE_PASSWORD=DATABASE_PROD_PASSWORD
```

`sit` and `uat` may contain concrete values only if the user explicitly provides them. Otherwise use placeholders:

```dotenv
SECRET_DATABASE_HOST=DATABASE_SIT_HOST
SECRET_DATABASE_PASSWORD=DATABASE_SIT_PASSWORD
```

## Validation

Run available builds:

```bash
kustomize build base
kustomize build overlays/sit
kustomize build overlays/uat
kustomize build overlays/prd
```

If `kustomize` is unavailable, inspect YAML references manually: resource names, generator names, mount names, and patch target kind/name must match.
