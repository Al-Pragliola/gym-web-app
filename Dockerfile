# Stage 1: Build Frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.25-alpine as backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Stage 3: Final Image
FROM alpine:latest
WORKDIR /root/

# Install certificates for HTTPS (Google Auth)
RUN apk --no-cache add ca-certificates

# Copy frontend build to ./dist
COPY --from=frontend-builder /app/dist ./dist

# Copy backend binary
COPY --from=backend-builder /app/backend/main .

# Expose port
EXPOSE 8080

# Run
CMD ["./main"]
