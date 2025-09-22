# Deployment Guide

**Production-ready deployment strategies for Vespera V2 across different environments and scales.**

## 🎯 Overview

This guide covers deploying Vespera V2 from small team setups to enterprise-scale installations. Choose the deployment strategy that matches your requirements:

- **🏠 Local Development**: Single-machine setup for development and testing
- **🏢 Small Team**: Docker-based deployment for 5-50 users
- **🏗️ Enterprise**: Kubernetes deployment for 50+ users with high availability
- **☁️ Cloud**: Cloud-native deployment with managed services

## 📋 Deployment Requirements

### Minimum System Requirements

| Component | Requirement | Recommended |
|-----------|-------------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **Memory** | 4GB RAM | 8GB+ RAM |
| **Storage** | 10GB SSD | 50GB+ SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Recommended System Requirements

| Deployment Size | CPU | Memory | Storage | Users |
|----------------|-----|---------|---------|-------|
| **Development** | 2 cores | 4GB | 20GB | 1-3 |
| **Small Team** | 4 cores | 8GB | 100GB | 5-25 |
| **Medium Team** | 8 cores | 16GB | 500GB | 25-100 |
| **Enterprise** | 16+ cores | 32GB+ | 1TB+ | 100+ |

### Port Requirements

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **REST API** | 8000 | HTTP/HTTPS | Web interface and plugins |
| **MCP Server** | N/A | Stdio | Claude Code integration |
| **WebSocket** | 8000 | WebSocket | Real-time updates |
| **Monitoring** | 9090 | HTTP | Prometheus metrics |
| **Health Check** | 8000 | HTTP | Load balancer health |

## 🏠 Local Development Deployment

### Quick Setup

```bash
# 1. Clone and setup
git clone https://github.com/your-org/vespera-atelier.git
cd vespera-atelier/packages/vespera-scriptorium

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize system
python setup_v2.py

# 5. Start services
./run_v2_server.sh &          # MCP server
python run_api_server.py &    # REST API server
```

### Development Configuration

Create `config/development.env`:

```bash
# Core settings
VESPERA_ENV=development
VESPERA_DATA_DIR=.vespera_v2
VESPERA_LOG_LEVEL=DEBUG

# API settings
VESPERA_API_HOST=127.0.0.1
VESPERA_API_PORT=8000
VESPERA_API_SECRET=dev-secret-key-change-in-production

# Database settings
SQLITE_DATABASE_PATH=.vespera_v2/tasks.db
CHROMA_PERSIST_DIRECTORY=.vespera_v2/chroma
KUZU_DATABASE_PATH=.vespera_v2/kuzu

# Background services (enabled for development)
ENABLE_AUTO_EMBEDDING=true
ENABLE_CYCLE_DETECTION=true
ENABLE_SYNC_SERVICES=true

# Performance (development-optimized)
MAX_CONCURRENT_TASKS=5
EMBEDDING_BATCH_SIZE=10
SYNC_INTERVAL_SECONDS=60

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Development Systemd Service

Create `/etc/systemd/system/vespera-dev.service`:

```ini
[Unit]
Description=Vespera V2 Development Server
After=network.target

[Service]
Type=simple
User=developer
WorkingDirectory=/home/developer/vespera-scriptorium
Environment=PATH=/home/developer/vespera-scriptorium/venv/bin
EnvironmentFile=/home/developer/vespera-scriptorium/config/development.env
ExecStart=/home/developer/vespera-scriptorium/venv/bin/python run_api_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 🏢 Small Team Docker Deployment

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  vespera-api:
    build: .
    container_name: vespera-api
    ports:
      - "8000:8000"
      - "9090:9090"  # Metrics
    environment:
      - VESPERA_ENV=production
      - VESPERA_API_HOST=0.0.0.0
      - VESPERA_API_PORT=8000
      - VESPERA_DATA_DIR=/data
      - SQLITE_DATABASE_PATH=/data/tasks.db
      - CHROMA_PERSIST_DIRECTORY=/data/chroma
      - KUZU_DATABASE_PATH=/data/kuzu
      - VESPERA_API_SECRET=${VESPERA_API_SECRET}
    volumes:
      - vespera_data:/data
      - ./config/production.env:/app/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: vespera-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - vespera-api
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: vespera-prometheus
    ports:
      - "9091:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: vespera-grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    restart: unless-stopped

volumes:
  vespera_data:
  prometheus_data:
  grafana_data:

networks:
  default:
    name: vespera-network
```

### Dockerfile

```dockerfile
FROM python:3.11-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim as runtime

# Create non-root user
RUN groupadd -r vespera && useradd -r -g vespera vespera

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/vespera/.local

# Copy application code
COPY . .
RUN chown -R vespera:vespera /app

# Create data directory
RUN mkdir -p /data && chown -R vespera:vespera /data

USER vespera

# Add local binaries to PATH
ENV PATH=/home/vespera/.local/bin:$PATH

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000 9090

CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream vespera_api {
        server vespera-api:8000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000" always;

        # API proxy
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://vespera_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # WebSocket endpoint
        location /ws/ {
            proxy_pass http://vespera_api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://vespera_api;
            access_log off;
        }

        # Static files (if any)
        location /static/ {
            alias /app/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Production Environment Configuration

Create `config/production.env`:

```bash
# Core settings
VESPERA_ENV=production
VESPERA_DATA_DIR=/data
VESPERA_LOG_LEVEL=INFO

# API settings
VESPERA_API_HOST=0.0.0.0
VESPERA_API_PORT=8000
VESPERA_API_SECRET=secure-random-secret-key-64-chars

# Database settings
SQLITE_DATABASE_PATH=/data/tasks.db
CHROMA_PERSIST_DIRECTORY=/data/chroma
KUZU_DATABASE_PATH=/data/kuzu

# Background services
ENABLE_AUTO_EMBEDDING=true
ENABLE_CYCLE_DETECTION=true
ENABLE_SYNC_SERVICES=true

# Performance (production-optimized)
MAX_CONCURRENT_TASKS=20
EMBEDDING_BATCH_SIZE=100
SYNC_INTERVAL_SECONDS=30

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Security
CORS_ORIGINS=https://your-domain.com
TRUSTED_HOSTS=your-domain.com

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=6
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=vespera-backups
```

### Deployment Commands

```bash
# 1. Create environment file
cp config/production.env.example .env
# Edit .env with your actual values

# 2. Generate SSL certificates (using Let's Encrypt)
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem

# 3. Start services
docker-compose up -d

# 4. Verify deployment
docker-compose ps
curl -f https://your-domain.com/health

# 5. Check logs
docker-compose logs -f vespera-api
```

## 🏗️ Enterprise Kubernetes Deployment

### Kubernetes Manifests

#### Namespace and ConfigMap

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vespera-system
  labels:
    name: vespera-system

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vespera-config
  namespace: vespera-system
data:
  VESPERA_ENV: "production"
  VESPERA_LOG_LEVEL: "INFO"
  VESPERA_API_HOST: "0.0.0.0"
  VESPERA_API_PORT: "8000"
  ENABLE_AUTO_EMBEDDING: "true"
  ENABLE_CYCLE_DETECTION: "true"
  ENABLE_SYNC_SERVICES: "true"
  MAX_CONCURRENT_TASKS: "50"
  EMBEDDING_BATCH_SIZE: "200"
  SYNC_INTERVAL_SECONDS: "15"
  ENABLE_METRICS: "true"
  METRICS_PORT: "9090"
```

#### Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: vespera-secrets
  namespace: vespera-system
type: Opaque
data:
  VESPERA_API_SECRET: <base64-encoded-secret>
  DATABASE_PASSWORD: <base64-encoded-password>
  S3_ACCESS_KEY: <base64-encoded-key>
  S3_SECRET_KEY: <base64-encoded-secret>
```

#### Persistent Storage

```yaml
# storage.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: vespera-data-pvc
  namespace: vespera-system
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: vespera-chroma-pvc
  namespace: vespera-system
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi
```

#### Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vespera-api
  namespace: vespera-system
  labels:
    app: vespera-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: vespera-api
  template:
    metadata:
      labels:
        app: vespera-api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: vespera-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: vespera-api
        image: vespera/api:v2.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        - containerPort: 9090
          name: metrics
        envFrom:
        - configMapRef:
            name: vespera-config
        - secretRef:
            name: vespera-secrets
        env:
        - name: VESPERA_DATA_DIR
          value: "/data"
        - name: CHROMA_PERSIST_DIRECTORY
          value: "/chroma"
        volumeMounts:
        - name: vespera-data
          mountPath: /data
        - name: vespera-chroma
          mountPath: /chroma
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
      volumes:
      - name: vespera-data
        persistentVolumeClaim:
          claimName: vespera-data-pvc
      - name: vespera-chroma
        persistentVolumeClaim:
          claimName: vespera-chroma-pvc
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - vespera-api
              topologyKey: kubernetes.io/hostname
```

#### Service and Ingress

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: vespera-api-service
  namespace: vespera-system
  labels:
    app: vespera-api
spec:
  selector:
    app: vespera-api
  ports:
  - name: http
    port: 80
    targetPort: 8000
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vespera-api-ingress
  namespace: vespera-system
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: "vespera-api-service"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  tls:
  - hosts:
    - api.vespera.company.com
    secretName: vespera-api-tls
  rules:
  - host: api.vespera.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vespera-api-service
            port:
              number: 80
```

#### HorizontalPodAutoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vespera-api-hpa
  namespace: vespera-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vespera-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Kubernetes Deployment Commands

```bash
# 1. Create namespace and basic resources
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f storage.yaml

# 2. Deploy application
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml

# 3. Verify deployment
kubectl get pods -n vespera-system
kubectl get services -n vespera-system
kubectl get ingress -n vespera-system

# 4. Check application health
kubectl exec -n vespera-system deployment/vespera-api -- curl -f http://localhost:8000/health

# 5. View logs
kubectl logs -n vespera-system deployment/vespera-api -f

# 6. Monitor autoscaling
kubectl get hpa -n vespera-system --watch
```

## ☁️ Cloud-Native Deployment

### AWS EKS Deployment

#### Infrastructure with Terraform

```hcl
# main.tf
provider "aws" {
  region = var.aws_region
}

# EKS Cluster
resource "aws_eks_cluster" "vespera" {
  name     = "vespera-cluster"
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = "1.27"

  vpc_config {
    subnet_ids = aws_subnet.vespera_subnets[*].id
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
  ]
}

# Node Group
resource "aws_eks_node_group" "vespera_nodes" {
  cluster_name    = aws_eks_cluster.vespera.name
  node_group_name = "vespera-nodes"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = aws_subnet.vespera_subnets[*].id

  instance_types = ["m5.large"]

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]
}

# RDS for PostgreSQL (optional upgrade from SQLite)
resource "aws_db_instance" "vespera_db" {
  identifier = "vespera-db"
  
  engine         = "postgres"
  engine_version = "14.9"
  instance_class = "db.r5.large"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = "vespera"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.vespera.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "vespera-db-final-snapshot"
  
  tags = {
    Name = "vespera-database"
  }
}

# ElastiCache for Redis (caching)
resource "aws_elasticache_subnet_group" "vespera" {
  name       = "vespera-cache-subnet"
  subnet_ids = aws_subnet.vespera_subnets[*].id
}

resource "aws_elasticache_replication_group" "vespera" {
  replication_group_id       = "vespera-cache"
  description                = "Redis cache for Vespera"
  
  node_type            = "cache.r6g.large"
  port                 = 6379
  parameter_group_name = "default.redis7"
  
  num_cache_clusters = 2
  
  subnet_group_name = aws_elasticache_subnet_group.vespera.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  
  tags = {
    Name = "vespera-cache"
  }
}
```

### Azure AKS Deployment

```bash
# Create resource group
az group create --name vespera-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group vespera-rg \
  --name vespera-aks \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring,azure-policy \
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 10 \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group vespera-rg --name vespera-aks

# Create Azure Database for PostgreSQL
az postgres flexible-server create \
  --resource-group vespera-rg \
  --name vespera-postgres \
  --admin-user vesperaadmin \
  --admin-password <secure-password> \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 14

# Create Azure Redis Cache
az redis create \
  --resource-group vespera-rg \
  --name vespera-redis \
  --location eastus \
  --sku Standard \
  --vm-size c1
```

### Google GKE Deployment

```bash
# Set project and zone
gcloud config set project vespera-project
gcloud config set compute/zone us-central1-a

# Create GKE cluster
gcloud container clusters create vespera-cluster \
  --num-nodes=3 \
  --machine-type=n1-standard-4 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials vespera-cluster

# Create Cloud SQL PostgreSQL instance
gcloud sql instances create vespera-postgres \
  --database-version=POSTGRES_14 \
  --tier=db-n1-standard-4 \
  --region=us-central1 \
  --storage-size=100GB \
  --storage-type=SSD \
  --backup-start-time=03:00

# Create Cloud Memorystore Redis instance
gcloud redis instances create vespera-redis \
  --size=5 \
  --region=us-central1 \
  --tier=standard
```

## 🔧 Production Configuration

### Environment-Specific Configurations

#### Production Settings

```python
# config/production.py
import os
from pathlib import Path

# Core settings
ENV = "production"
DEBUG = False
LOG_LEVEL = "INFO"

# API settings
API_HOST = "0.0.0.0"
API_PORT = 8000
API_SECRET = os.getenv("VESPERA_API_SECRET")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")

# Database settings
if os.getenv("DATABASE_URL"):
    # PostgreSQL for production
    DATABASE_URL = os.getenv("DATABASE_URL")
else:
    # SQLite fallback
    DATABASE_URL = f"sqlite:///{Path(os.getenv('VESPERA_DATA_DIR', '.')) / 'tasks.db'}"

CHROMA_PERSIST_DIRECTORY = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma")
KUZU_DATABASE_PATH = os.getenv("KUZU_DATABASE_PATH", "./kuzu")

# Redis settings (if available)
REDIS_URL = os.getenv("REDIS_URL")

# Background services
ENABLE_AUTO_EMBEDDING = True
ENABLE_CYCLE_DETECTION = True
ENABLE_SYNC_SERVICES = True

# Performance settings
MAX_CONCURRENT_TASKS = int(os.getenv("MAX_CONCURRENT_TASKS", "50"))
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "200"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "15"))

# Monitoring
ENABLE_METRICS = True
METRICS_PORT = 9090

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        },
        "json": {
            "format": '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}'
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "level": "INFO"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/vespera/vespera.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
            "level": "INFO"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "file"]
    }
}

# Security
TRUSTED_HOSTS = os.getenv("TRUSTED_HOSTS", "").split(",")
SECURE_HEADERS = True

# Backup settings
BACKUP_ENABLED = os.getenv("BACKUP_ENABLED", "true").lower() == "true"
BACKUP_INTERVAL_HOURS = int(os.getenv("BACKUP_INTERVAL_HOURS", "6"))
BACKUP_S3_BUCKET = os.getenv("BACKUP_S3_BUCKET")
BACKUP_S3_PREFIX = os.getenv("BACKUP_S3_PREFIX", "vespera-backups")
```

### SSL/TLS Configuration

#### Certificate Management

```bash
# Generate self-signed certificate for testing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Using Let's Encrypt with certbot
certbot certonly --standalone -d api.vespera.company.com

# Certificate renewal with cron
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### SSL Configuration for Nginx

```nginx
# ssl.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## 📊 Monitoring and Maintenance

### Health Checks

Create comprehensive health checks:

```python
# health_checks.py
import asyncio
import time
from typing import Dict, Any

class HealthChecker:
    async def check_all_services(self) -> Dict[str, Any]:
        start_time = time.time()
        
        checks = await asyncio.gather(
            self.check_api_server(),
            self.check_database(),
            self.check_background_services(),
            self.check_external_dependencies(),
            return_exceptions=True
        )
        
        return {
            "status": "healthy" if all(c.get("healthy", False) for c in checks if isinstance(c, dict)) else "unhealthy",
            "timestamp": time.time(),
            "response_time": time.time() - start_time,
            "checks": {
                "api_server": checks[0] if isinstance(checks[0], dict) else {"healthy": False, "error": str(checks[0])},
                "database": checks[1] if isinstance(checks[1], dict) else {"healthy": False, "error": str(checks[1])},
                "background_services": checks[2] if isinstance(checks[2], dict) else {"healthy": False, "error": str(checks[2])},
                "external_dependencies": checks[3] if isinstance(checks[3], dict) else {"healthy": False, "error": str(checks[3])}
            }
        }
    
    async def check_api_server(self) -> Dict[str, Any]:
        # Check API responsiveness
        try:
            # Test basic endpoint
            response = await self.make_request("/health")
            return {
                "healthy": response.status_code == 200,
                "response_time": response.elapsed.total_seconds(),
                "status_code": response.status_code
            }
        except Exception as e:
            return {"healthy": False, "error": str(e)}
    
    async def check_database(self) -> Dict[str, Any]:
        # Check database connectivity and performance
        try:
            from databases import TripleDbService
            db = TripleDbService()
            
            start_time = time.time()
            # Test database operations
            await db.health_check()
            response_time = time.time() - start_time
            
            return {
                "healthy": True,
                "response_time": response_time,
                "connections": db.get_connection_count(),
                "disk_usage": db.get_disk_usage()
            }
        except Exception as e:
            return {"healthy": False, "error": str(e)}
```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="vespera_backup_$TIMESTAMP"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Backup SQLite database
if [ -f "/data/tasks.db" ]; then
    sqlite3 /data/tasks.db ".backup $BACKUP_DIR/$BACKUP_NAME/tasks.db"
    echo "SQLite database backed up"
fi

# Backup ChromaDB
if [ -d "/data/chroma" ]; then
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/chroma.tar.gz" -C /data chroma
    echo "ChromaDB backed up"
fi

# Backup Kuzu database
if [ -d "/data/kuzu" ]; then
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/kuzu.tar.gz" -C /data kuzu
    echo "Kuzu database backed up"
fi

# Backup configuration
if [ -d "/app/config" ]; then
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/config.tar.gz" -C /app config
    echo "Configuration backed up"
fi

# Create final archive
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Upload to S3 (if configured)
if [ -n "$AWS_S3_BUCKET" ]; then
    aws s3 cp "$BACKUP_NAME.tar.gz" "s3://$AWS_S3_BUCKET/backups/"
    echo "Backup uploaded to S3"
fi

# Clean up old backups
find "$BACKUP_DIR" -name "vespera_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "Old backups cleaned up"

echo "Backup completed: $BACKUP_NAME.tar.gz"
```

### Monitoring with Prometheus

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "vespera_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'vespera-api'
    static_configs:
      - targets: ['vespera-api:9090']
    metrics_path: /metrics
    scrape_interval: 30s
    
  - job_name: 'vespera-health'
    static_configs:
      - targets: ['vespera-api:8000']
    metrics_path: /health
    scrape_interval: 60s
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### Container Won't Start

```bash
# Check container logs
docker logs vespera-api

# Common issues:
# 1. Missing environment variables
# 2. Port conflicts
# 3. Volume mount permissions
# 4. Database connection failures

# Debug steps:
docker exec -it vespera-api bash
curl -f http://localhost:8000/health
ls -la /data
```

#### Database Connection Issues

```bash
# Check database connectivity
docker exec vespera-api python -c "
from databases import TripleDbService
db = TripleDbService()
print('Database connection:', db.health_check())
"

# Check disk space
df -h /data

# Check database files
ls -la /data/
sqlite3 /data/tasks.db ".tables"
```

#### Performance Issues

```bash
# Check resource usage
docker stats vespera-api

# Check background services
docker exec vespera-api python -c "
from databases import BackgroundServiceManager
bsm = BackgroundServiceManager()
print('Service status:', bsm.get_service_status())
"

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/tasks/
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443

# Check Let's Encrypt renewal
certbot certificates
```

### Maintenance Procedures

#### Rolling Updates

```bash
# Kubernetes rolling update
kubectl set image deployment/vespera-api vespera-api=vespera/api:v2.1.0 -n vespera-system

# Docker Compose rolling update
docker-compose pull
docker-compose up -d --no-deps vespera-api

# Monitor rollout
kubectl rollout status deployment/vespera-api -n vespera-system
```

#### Database Maintenance

```bash
# SQLite optimization
sqlite3 /data/tasks.db "VACUUM;"
sqlite3 /data/tasks.db "ANALYZE;"

# ChromaDB maintenance
docker exec vespera-api python -c "
from databases import ChromaService
chroma = ChromaService()
chroma.optimize_index()
"
```

---

**🎉 You're now equipped to deploy Vespera V2 in any environment!**

*Next: Configure [Monitoring & Logging](monitoring.md) for operational excellence, or explore [Security Configuration](security.md) for hardening your deployment.*