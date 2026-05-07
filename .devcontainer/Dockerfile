FROM --platform=linux/arm64 node:22-bookworm-slim

# Install dev tools
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
COPY src/ ./src/

# Database and workspace directories
RUN mkdir -p /app/data /workspace/Projects && chown -R node:node /app/data /workspace
WORKDIR /workspace

# Run as non-root user
USER node

EXPOSE 4000

CMD ["node", "/app/server.js"]
