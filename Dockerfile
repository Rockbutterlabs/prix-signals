# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and required packages for the parser
RUN apk add --no-cache python3 py3-pip

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Verify TypeScript is installed
RUN npx tsc --version

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Python and required packages for the parser
RUN apk add --no-cache python3 py3-pip

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"] 