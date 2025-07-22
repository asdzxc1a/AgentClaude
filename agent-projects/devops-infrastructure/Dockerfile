# Multi-stage DevOps Infrastructure Container
# Includes Terraform, Ansible, kubectl, Helm, and monitoring tools

FROM alpine:3.19 as base
RUN apk add --no-cache \
    curl \
    wget \
    git \
    bash \
    openssh-client \
    ca-certificates \
    python3 \
    py3-pip \
    jq \
    yq

# Terraform installation
FROM base as terraform
ARG TERRAFORM_VERSION=1.6.5
RUN wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform_${TERRAFORM_VERSION}_linux_amd64.zip

# Ansible installation
FROM base as ansible
RUN pip3 install --no-cache-dir \
    ansible==9.1.0 \
    ansible-core==2.16.1 \
    boto3==1.34.0 \
    kubernetes==28.1.0 \
    openshift==0.13.2

# Kubernetes tools
FROM base as k8s-tools
ARG KUBECTL_VERSION=v1.29.0
ARG HELM_VERSION=v3.13.3
ARG KUSTOMIZE_VERSION=v5.3.0

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install Helm
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \
    && chmod 700 get_helm.sh \
    && ./get_helm.sh --version ${HELM_VERSION} \
    && rm get_helm.sh

# Install Kustomize
RUN curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash -s ${KUSTOMIZE_VERSION} \
    && mv kustomize /usr/local/bin/

# Cloud CLI tools
FROM base as cloud-tools
ARG AWS_CLI_VERSION=2.15.0
ARG AZURE_CLI_VERSION=2.56.0
ARG GCLOUD_VERSION=458.0.1

# Install AWS CLI
RUN apk add --no-cache groff less \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWS_CLI_VERSION}.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Install Azure CLI
RUN pip3 install --no-cache-dir azure-cli==${AZURE_CLI_VERSION}

# Install Google Cloud SDK
RUN curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-${GCLOUD_VERSION}-linux-x86_64.tar.gz \
    && tar -xzf google-cloud-cli-${GCLOUD_VERSION}-linux-x86_64.tar.gz \
    && ./google-cloud-sdk/install.sh --quiet \
    && rm -rf google-cloud-cli-${GCLOUD_VERSION}-linux-x86_64.tar.gz

# Security tools
FROM base as security-tools
ARG TRIVY_VERSION=0.48.3
ARG COSIGN_VERSION=v2.2.2

# Install Trivy
RUN wget -qO- https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz | tar -xzf - \
    && mv trivy /usr/local/bin/

# Install Cosign
RUN wget https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64 \
    && chmod +x cosign-linux-amd64 \
    && mv cosign-linux-amd64 /usr/local/bin/cosign

# Monitoring tools
FROM base as monitoring-tools
ARG PROMETHEUS_VERSION=2.48.1
ARG GRAFANA_VERSION=10.2.3

# Install Prometheus tools
RUN wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz \
    && tar -xzf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz \
    && mv prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool /usr/local/bin/ \
    && rm -rf prometheus-${PROMETHEUS_VERSION}*

# Final stage - combine all tools
FROM base as final

# Copy tools from previous stages
COPY --from=terraform /usr/local/bin/terraform /usr/local/bin/
COPY --from=ansible /usr/lib/python3.11/site-packages /usr/lib/python3.11/site-packages
COPY --from=ansible /usr/bin/ansible* /usr/local/bin/
COPY --from=k8s-tools /usr/local/bin/* /usr/local/bin/
COPY --from=cloud-tools /usr/local/aws-cli /usr/local/aws-cli
COPY --from=cloud-tools /usr/local/bin/aws /usr/local/bin/
COPY --from=cloud-tools /usr/lib/python3.11/site-packages/azure* /usr/lib/python3.11/site-packages/
COPY --from=cloud-tools /google-cloud-sdk /google-cloud-sdk
COPY --from=security-tools /usr/local/bin/* /usr/local/bin/
COPY --from=monitoring-tools /usr/local/bin/promtool /usr/local/bin/

# Install Node.js for additional tooling
RUN apk add --no-cache nodejs npm

# Set up environment
ENV PATH="/google-cloud-sdk/bin:${PATH}"
ENV PYTHONPATH="/usr/lib/python3.11/site-packages:${PYTHONPATH}"

# Create workspace
WORKDIR /workspace

# Copy project files
COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY terraform/ ./terraform/
COPY ansible/ ./ansible/
COPY k8s/ ./k8s/
COPY charts/ ./charts/
COPY monitoring/ ./monitoring/
COPY security/ ./security/
COPY scripts/ ./scripts/

# Set execute permissions
RUN chmod +x scripts/*.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD terraform version && kubectl version --client && helm version --client || exit 1

# Default command
CMD ["/bin/bash"]

# Labels for observability
LABEL maintainer="claude-devops-agent@claude.ai" \
      version="1.0.0" \
      description="DevOps Infrastructure Automation Container" \
      project="claude-agent-observability"

# Claude Agent metadata
LABEL claude.agent.id="devops-agent" \
      claude.agent.type="infrastructure" \
      claude.agent.capabilities="terraform,ansible,kubernetes,docker,monitoring"