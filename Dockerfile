# Stage 1: Build the Vite React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node Express Backend and serve
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --only=production

# Copy server codebase
COPY server/ ./server/

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port and configure environment
ENV PORT=5000
ENV DATABASE_PATH=/app/data/inventory.db
EXPOSE 5000

# Create volume mount point for database persistence
RUN mkdir -p /app/data

# Run start script
CMD ["node", "server/server.js"]
