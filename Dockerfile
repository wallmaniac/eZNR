# Stage 1: Build Next.js
FROM node:20-slim AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Stage 2: Production — Node.js + Python
FROM node:20-slim
WORKDIR /app

# Install Python + pdf2docx dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    libmupdf-dev \
    --no-install-recommends \
    && pip3 install pdf2docx --break-system-packages \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy built Next.js app
COPY --from=builder /app ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Copy the Python conversion script
COPY app/scripts/pdf2word.py ./scripts/pdf2word.py

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node_modules/.bin/next", "start"]
