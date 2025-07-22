# 🚀 DevOps Infrastructure - Cloud Automation Agent Demo

## Project Overview
Comprehensive cloud infrastructure automation and deployment pipeline demonstrating modern DevOps practices with Infrastructure as Code, container orchestration, CI/CD pipelines, and comprehensive monitoring. This project showcases typical DevOps tasks that generate extensive observable events for multi-cloud operations.

## Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Git Repos     │────│  CI/CD Pipeline │────│ Cloud Providers │
│  (Source Code)  │    │ (GitHub Actions)│    │  (AWS/Azure/GCP)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │ Observability   │
                    │ Event Capture   │
                    └─────────────────┘

Container Orchestration Layer:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Kubernetes     │────│   Monitoring    │────│   Security      │
│   Clusters      │    │ (Prometheus)    │    │  (Falco/OPA)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### Infrastructure as Code
- **Terraform**: Multi-cloud infrastructure provisioning
- **Ansible**: Configuration management and application deployment
- **Pulumi**: Modern infrastructure programming
- **CloudFormation**: AWS-specific infrastructure templates

### Container Orchestration
- **Kubernetes**: Container orchestration and management
- **Docker**: Containerization and image management
- **Helm**: Kubernetes package management
- **Istio**: Service mesh for microservices

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Jenkins**: Enterprise CI/CD automation
- **ArgoCD**: GitOps continuous deployment
- **Tekton**: Cloud-native CI/CD pipelines

### Monitoring & Observability
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation and analysis

### Security & Compliance
- **Falco**: Runtime security monitoring
- **Open Policy Agent**: Policy enforcement
- **Twistlock**: Container security scanning
- **Vault**: Secrets management

## Typical Agent Tasks

### Infrastructure Provisioning
```bash
# Plan and apply Terraform infrastructure
terraform init
terraform plan -out=tfplan -var-file="environments/prod.tfvars"
terraform apply tfplan
terraform destroy -auto-approve
```

### Container Operations
```bash
# Build and deploy containers
docker build -t myapp:v1.2.3 .
docker push registry.example.com/myapp:v1.2.3
kubectl apply -f k8s/deployment.yaml
helm upgrade myapp charts/myapp --set image.tag=v1.2.3
```

### Configuration Management
```bash
# Ansible playbook execution
ansible-galaxy install -r requirements.yml
ansible-playbook -i inventory/production playbooks/webserver.yml
ansible-vault encrypt group_vars/production/secrets.yml
```

### Monitoring & Alerting
```bash
# Deploy monitoring stack
kubectl apply -f monitoring/prometheus/
kubectl apply -f monitoring/grafana/
kubectl port-forward svc/grafana 3000:80
promtool query instant 'up{job="kubernetes-apiservers"}'
```

### Security Operations
```bash
# Security scanning and policy enforcement
docker scan myapp:latest
trivy image myapp:latest
kubectl apply -f security/policies/
falco --config /etc/falco/falco.yaml
```

## Observable Events Generated

This project generates comprehensive DevOps observability:

- **PreToolUse**: Terraform plans, Docker builds, kubectl commands, Ansible playbooks
- **PostToolUse**: Infrastructure state, deployment status, security scan results
- **UserPromptSubmit**: Infrastructure requests, scaling decisions, incident responses
- **Notification**: Deployment completions, security alerts, resource warnings
- **Stop/SubagentStop**: Pipeline completions, maintenance windows, rollback operations

## Cloud Platforms

### Amazon Web Services (AWS)
- **EC2**: Virtual machine provisioning
- **EKS**: Managed Kubernetes service
- **RDS**: Database management
- **S3**: Object storage and backup
- **CloudWatch**: Monitoring and logging

### Microsoft Azure
- **Virtual Machines**: Compute resources
- **AKS**: Azure Kubernetes Service
- **Azure Monitor**: Comprehensive monitoring
- **Key Vault**: Secrets management
- **Resource Manager**: Infrastructure templates

### Google Cloud Platform (GCP)
- **Compute Engine**: Virtual machines
- **GKE**: Google Kubernetes Engine
- **Cloud Monitoring**: Observability platform
- **Secret Manager**: Secrets handling
- **Deployment Manager**: Infrastructure automation

## Project Structure

```
devops-infrastructure/
├── terraform/              # Infrastructure as Code
│   ├── modules/            # Reusable Terraform modules
│   ├── environments/       # Environment-specific configs
│   └── providers/          # Cloud provider configurations
├── ansible/                # Configuration management
│   ├── playbooks/          # Ansible playbooks
│   ├── roles/              # Reusable roles
│   └── inventory/          # Environment inventories
├── k8s/                    # Kubernetes manifests
│   ├── base/               # Base configurations
│   ├── overlays/           # Environment overlays
│   └── operators/          # Custom operators
├── charts/                 # Helm charts
├── docker/                 # Dockerfile templates
├── monitoring/             # Monitoring configurations
│   ├── prometheus/         # Metrics collection
│   ├── grafana/            # Dashboards
│   └── alerting/           # Alert rules
├── security/               # Security policies
├── scripts/                # Automation scripts
├── pipelines/              # CI/CD pipeline definitions
└── tests/                  # Infrastructure tests
```

## Environment Management

### Development Environment
```bash
# Local development setup
terraform workspace select dev
terraform apply -var-file="environments/dev.tfvars"
kubectl config use-context dev-cluster
helm install myapp charts/myapp -f values-dev.yaml
```

### Staging Environment
```bash
# Staging deployment
terraform workspace select staging
terraform apply -var-file="environments/staging.tfvars"
kubectl config use-context staging-cluster
kubectl apply -k k8s/overlays/staging
```

### Production Environment
```bash
# Production deployment with approval
terraform workspace select prod
terraform plan -var-file="environments/prod.tfvars"
# Manual approval required for production
terraform apply tfplan
kubectl config use-context prod-cluster
kubectl apply -k k8s/overlays/production
```

## CI/CD Pipeline Workflows

### Build Pipeline
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Run security scan
        run: trivy image myapp:${{ github.sha }}
      - name: Push to registry
        run: docker push myapp:${{ github.sha }}
```

### Deployment Pipeline
```yaml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/myapp myapp=myapp:${{ github.sha }}
          kubectl rollout status deployment/myapp
      - name: Run integration tests
        run: npm run test:integration
```

## Monitoring and Alerting

### Key Metrics
- **Infrastructure Health**: CPU, memory, disk utilization
- **Application Performance**: Response time, error rates, throughput
- **Security Events**: Failed authentications, policy violations
- **Cost Optimization**: Resource utilization, cost per service

### Alert Rules
```yaml
groups:
- name: infrastructure.rules
  rules:
  - alert: HighCPUUsage
    expr: cpu_usage_percent > 80
    for: 5m
    annotations:
      summary: "High CPU usage detected"
  
  - alert: PodCrashLooping
    expr: rate(kube_pod_container_status_restarts_total[5m]) > 0
    annotations:
      summary: "Pod is crash looping"
```

## Disaster Recovery

### Backup Strategies
```bash
# Database backups
kubectl exec postgres-0 -- pg_dump dbname > backup.sql
aws s3 cp backup.sql s3://backups/database/

# Infrastructure state backup
terraform state pull > terraform.tfstate.backup
aws s3 cp terraform.tfstate.backup s3://backups/terraform/

# Kubernetes configuration backup
kubectl get all --all-namespaces -o yaml > k8s-backup.yaml
```

### Recovery Procedures
```bash
# Infrastructure recovery
terraform init
terraform import aws_instance.web i-1234567890abcdef0
terraform plan -refresh=true

# Application recovery
kubectl apply -f k8s-backup.yaml
kubectl rollout restart deployment/myapp
```

## Security Best Practices

### Infrastructure Security
- Network segmentation with VPCs and security groups
- Identity and access management (IAM)
- Encryption at rest and in transit
- Regular security audits and compliance checks

### Container Security
- Minimal base images and regular updates
- Runtime security monitoring
- Image vulnerability scanning
- Pod security policies and admission controllers

### Secrets Management
```bash
# Vault integration
vault kv put secret/myapp/db password=secret123
kubectl create secret generic db-secret \
  --from-literal=password="$(vault kv get -field=password secret/myapp/db)"
```

This project provides a realistic DevOps scenario where Claude Code agents can demonstrate:
- Multi-cloud infrastructure management
- Container orchestration at scale
- Automated deployment pipelines
- Comprehensive monitoring and alerting
- Security and compliance automation
- Disaster recovery and business continuity