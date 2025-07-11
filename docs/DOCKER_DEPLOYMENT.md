# Docker Deployment Guide

## Overview

This guide covers deploying the Finance Tracker application using Docker. The application is containerized as a single Docker image that includes automatic database migrations and connects to an external PostgreSQL database.

## Docker Hub Registry

The official Finance Tracker Docker images are available at:
- **Registry**: `dfsf5263/finance-tracker`
- **Tags**: `latest`, version tags (e.g., `v1.0.0`)

## Prerequisites

### Required Services
- **PostgreSQL Database**: External PostgreSQL instance (version 12+)
- **Docker**: Docker Engine 20.10+ or Docker Desktop

### Required Environment Variables

```bash
# Database Connection (Required)
DATABASE_URL=postgresql://username:password@host:port/database_name

# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_publishable_key
CLERK_SECRET_KEY=sk_live_your_secret_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Optional Configuration
NODE_ENV=production
PORT=3000
SKIP_MIGRATIONS=false
ENABLE_SEEDING=false
```

## Quick Start

### 1. Basic Deployment

```bash
docker run -d \
  --name finance-tracker \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/finance_db" \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  -e CLERK_SECRET_KEY="sk_live_..." \
  -e CLERK_WEBHOOK_SECRET="whsec_..." \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

### 2. Using Environment File

Create `.env.production`:
```bash
DATABASE_URL=postgresql://user:password@host:5432/finance_db
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
```

Deploy with environment file:
```bash
docker run -d \
  --name finance-tracker \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

## Container Lifecycle

### Startup Sequence

The container performs the following steps on startup:

1. **Environment Validation**: Checks required environment variables
2. **Database Connectivity**: Waits for PostgreSQL to be available
3. **Database Migration**: Runs `prisma migrate deploy` automatically
4. **Prisma Client Generation**: Ensures latest schema is available
5. **Health Check**: Validates database connection
6. **Application Start**: Launches Next.js production server

### Health Monitoring

The container includes built-in health checks:

- **Health Endpoint**: `GET /api/health`
- **Docker Health Check**: Runs every 30 seconds
- **Startup Grace Period**: 60 seconds before health checks start

Example health check response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "service": "finance-tracker",
  "version": "1.0.0"
}
```

## Database Setup

### PostgreSQL Requirements

- **Version**: PostgreSQL 12 or higher
- **Extensions**: None required (using standard SQL)
- **Encoding**: UTF-8
- **Permissions**: The database user needs:
  - `CREATE` (for initial schema creation)
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` (for application operations)

### Database Migration

Migrations are handled automatically by the container:

- Runs `npx prisma migrate deploy` on startup
- Creates tables and applies schema changes
- Idempotent (safe to run multiple times)
- Can be skipped with `SKIP_MIGRATIONS=true`

### Initial Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE finance_tracker;
CREATE USER finance_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE finance_tracker TO finance_user;
ALTER USER finance_user CREATEDB; --For Prisma Migrations
```

2. The application will create all necessary tables on first startup.

## Production Deployment Examples

### Basic Production Setup

```bash
# Pull latest image
docker pull dfsf5263/finance-tracker:latest

# Run with production configuration
docker run -d \
  --name finance-tracker-prod \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://finance_user:secure_password@db.example.com:5432/finance_tracker" \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_your_key" \
  -e CLERK_SECRET_KEY="sk_live_your_secret" \
  -e CLERK_WEBHOOK_SECRET="whsec_your_webhook_secret" \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --memory=512m \
  --cpus=0.5 \
  dfsf5263/finance-tracker:latest
```

### With Custom Network

```bash
# Create network for database communication
docker network create finance-network

# Run application on custom network
docker run -d \
  --name finance-tracker \
  --network finance-network \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

### Behind Reverse Proxy

```bash
# Run without exposing port (behind nginx/traefik)
docker run -d \
  --name finance-tracker \
  --network web \
  --env-file .env.production \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_live_...` |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook secret | `whsec_...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `3000` | Application port |
| `SKIP_MIGRATIONS` | `false` | Skip database migrations |
| `ENABLE_SEEDING` | `false` | Run database seeding |
| `DB_WAIT_TIMEOUT` | `30` | Database wait timeout (seconds) |

### Clerk Configuration

1. **Get Clerk Keys**: Sign up at [clerk.com](https://clerk.com)
2. **Create Application**: Set up your Finance Tracker app
3. **Configure URLs**:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`

## Monitoring and Logging

### Container Logs

View application logs:
```bash
# Real-time logs
docker logs -f finance-tracker

# Last 100 lines
docker logs --tail 100 finance-tracker

# Logs with timestamps
docker logs -t finance-tracker
```

### Health Monitoring

Check container health:
```bash
# Docker health status
docker inspect --format='{{.State.Health.Status}}' finance-tracker

# Application health endpoint
curl http://localhost:3000/api/health
```

### Resource Monitoring

Monitor resource usage:
```bash
# Real-time stats
docker stats finance-tracker

# Container details
docker inspect finance-tracker
```

## Backup and Recovery

### Database Backup

```bash
# Create database backup
docker exec -i postgres_container pg_dump -U finance_user finance_tracker > backup.sql

# Restore from backup
docker exec -i postgres_container psql -U finance_user finance_tracker < backup.sql
```

### Container Data

The Finance Tracker container is stateless. All data is stored in the external PostgreSQL database.

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check database connectivity
docker logs finance-tracker | grep "DB-WAIT"

# Verify DATABASE_URL format
echo $DATABASE_URL
```

#### 2. Migration Errors
```bash
# Check migration logs
docker logs finance-tracker | grep "ENTRYPOINT"

# Skip migrations if needed
docker run ... -e SKIP_MIGRATIONS=true ...
```

#### 3. Container Won't Start
```bash
# Check environment variables
docker exec finance-tracker env

# Validate configuration
docker run --rm dfsf5263/finance-tracker:latest ./scripts/wait-for-db.sh
```

#### 4. Application Errors
```bash
# Check application logs
docker logs finance-tracker | grep "ERROR"

# Test health endpoint
curl -f http://localhost:3000/api/health
```

### Debug Mode

Run container in debug mode:
```bash
docker run -it --rm \
  --env-file .env.production \
  dfsf5263/finance-tracker:latest \
  /bin/sh
```

## Security Considerations

### Container Security
- ✅ Runs as non-root user (`nextjs:nodejs`)
- ✅ Minimal Alpine Linux base image
- ✅ No unnecessary packages installed
- ✅ Read-only filesystem where possible

### Environment Security
- 🔒 **Never expose secrets in logs**
- 🔒 **Use secure DATABASE_URL connections (SSL)**
- 🔒 **Rotate Clerk secrets regularly**
- 🔒 **Use environment files instead of command-line args**

### Network Security
- 🔒 **Use custom Docker networks**
- 🔒 **Run behind reverse proxy with SSL**
- 🔒 **Restrict database access to application only**
- 🔒 **Use firewall rules to limit container access**

## Performance Tuning

### Resource Limits

Recommended production limits:
```bash
docker run -d \
  --memory=512m \
  --memory-swap=1g \
  --cpus=0.5 \
  --ulimit nofile=65536:65536 \
  ...
```

### Database Optimization

- Use connection pooling in DATABASE_URL
- Configure appropriate PostgreSQL settings
- Monitor database performance
- Regular database maintenance

## Updates and Maintenance

### Updating the Application

1. **Pull new image**:
```bash
docker pull dfsf5263/finance-tracker:latest
```

2. **Stop current container**:
```bash
docker stop finance-tracker
docker rm finance-tracker
```

3. **Start new container**:
```bash
docker run -d \
  --name finance-tracker \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

### Zero-Downtime Updates

For zero-downtime updates, use a reverse proxy and deploy to a new container name, then switch traffic.

## Support

### Getting Help

- **Documentation**: Check this guide and README.md
- **Logs**: Always check container logs first
- **Health Check**: Use `/api/health` endpoint
- **GitHub Issues**: Report bugs and issues

### Useful Commands

```bash
# Quick health check
curl -f http://localhost:3000/api/health && echo "✅ Healthy" || echo "❌ Unhealthy"

# Container resource usage
docker stats finance-tracker --no-stream

# Restart container
docker restart finance-tracker

# Update and restart
docker pull dfsf5263/finance-tracker:latest && docker restart finance-tracker
```