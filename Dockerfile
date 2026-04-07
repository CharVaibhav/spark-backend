# Build Stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies needed for compilation (if any)
RUN apt-get update && apt-get install -y python3 make g++ 

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime Stage
FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /app

# Set production env
ENV NODE_ENV=production

# Copy built files and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prod-server.js ./prod-server.js

# Install ONLY production dependencies
RUN npm install --omit=dev

# Install only the chromium browser for the worker
# PlaywrightCrawler in the worker uses it for crawling.
RUN npx playwright install chromium --with-deps

EXPOSE 3001

# Start both API and Worker in one container via the bootstrap script
CMD ["node", "prod-server.js"]
