FROM --platform=linux/arm64 node:22-bookworm-slim

# Install dev tools (no sudo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Bake app into image ---
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js ./

# Workspace: only Humai-Workspace contents will be mounted here
RUN mkdir -p /workspace/Projects && chown -R node:node /workspace
WORKDIR /workspace

# Run as non-root user (node user already exists in node image)
USER node

EXPOSE 3000

CMD ["node", "/app/server.js"]
