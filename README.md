# Finance Tracker

A modern, secure personal finance tracking application built with Next.js 15, TypeScript, and PostgreSQL. Features comprehensive transaction management, analytics, budgeting, and multi-household support with enterprise-grade security.

## Features

- 🏠 **Multi-Household Support** - Manage multiple households with role-based access
- 💰 **Transaction Management** - Track income, expenses, and transfers with detailed categorization
- 📊 **Analytics & Reporting** - Visual breakdowns, money flow analysis, and spending insights
- 💸 **Budget Management** - Set and track budgets for households and individual users
- 📱 **Modern UI** - Clean, responsive interface with dark/light theme support
- 🔐 **Enterprise Security** - Rate limiting, input validation, audit trails, and session management
- 📈 **CSV Import/Export** - Bulk transaction import with intelligent duplicate detection
- 🎯 **Smart Categories** - Customizable transaction categories and types
- 👥 **User Management** - Invite and manage household members
- 🔒 **Authentication** - Secure authentication with Clerk

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Security**: Comprehensive rate limiting, input validation, CORS protection
- **Deployment**: Docker with production-ready containerization

## Quick Start

### Using Docker (Recommended for Production)

The easiest way to run Finance Tracker is using the pre-built Docker image:

```bash
# Pull and run the latest version
docker run -d \
  --name finance-tracker \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/database" \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  -e CLERK_SECRET_KEY="sk_live_..." \
  -e CLERK_WEBHOOK_SECRET="whsec_..." \
  --restart unless-stopped \
  dfsf5263/finance-tracker:latest
```

The application will be available at `http://localhost:3000`. Database migrations run automatically on startup.

**📖 For complete deployment instructions, see [Docker Deployment Guide](docs/DOCKER_DEPLOYMENT.md)**

### Local Development

For development and testing:

1. **Clone the repository**:
```bash
git clone https://github.com/your-username/finance-tracker.git
cd finance-tracker
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your database and Clerk credentials
```

4. **Set up the database**:
```bash
npx prisma migrate dev
npx prisma db seed
```

5. **Start the development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# Clerk Authentication (get from https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."  # Public key (safe to embed)
CLERK_SECRET_KEY="sk_live_..."                   # Secret key (runtime only)
CLERK_WEBHOOK_SECRET="whsec_..."                 # Webhook secret (runtime only)
```

### Optional Variables

```bash
# Clerk URLs (defaults shown)
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# Application
NODE_ENV="production"
PORT=3000
```

## Database Setup

Finance Tracker uses PostgreSQL with Prisma ORM:

### PostgreSQL Requirements
- PostgreSQL 12 or higher
- UTF-8 encoding
- User with CREATE, SELECT, INSERT, UPDATE, DELETE permissions

### Migration and Seeding
```bash
# Run migrations
npx prisma migrate deploy

# Seed with default data (categories, transaction types)
npx prisma db seed

# Generate Prisma client (if needed)
npx prisma generate
```

## Docker Deployment

### Pre-built Images

Official images are available on Docker Hub at `dfsf5263/finance-tracker`:

- `latest` - Latest stable release
- `v1.0.0` - Specific version tags

### Building Locally

Build your own Docker image:

**Prerequisites for Building:**
- Only Clerk public key needed during build (safe to embed)
- Secret keys are provided at runtime only (never built into image)

```bash
# Build image with explicit Clerk key (builds for linux/amd64 by default)
./scripts/docker-build.sh --clerk-key pk_live_your_key_here

# Build and push to registry
./scripts/docker-build.sh --push --version v1.0.0 --clerk-key pk_live_your_key_here

# Build for specific platform (e.g., Apple Silicon)
./scripts/docker-build.sh --platform linux/arm64 --clerk-key pk_live_your_key_here

# Build with environment variable
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." ./scripts/docker-build.sh --tag development

# Manual Docker build with build args
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  -t dfsf5263/finance-tracker:latest .
```

**🔒 Security Notes:** 
- `CLERK_SECRET_KEY` and other sensitive keys are never built into the Docker image
- Clerk public key must be explicitly provided (no `.env.local` fallback)
- This prevents accidental mixing of development/production keys
- All secrets are provided securely at runtime via environment variables

**🏗️ Platform Notes:**
- Images are built for `linux/amd64` by default for maximum server compatibility
- Use `--platform linux/arm64` for Apple Silicon/ARM-based systems
- The Dockerfile includes platform specifications for consistent builds

### Production Deployment

The Docker container includes:
- ✅ Automatic database migrations on startup
- ✅ Health checks and monitoring endpoints
- ✅ Non-root user security
- ✅ Optimized Alpine Linux base
- ✅ Graceful shutdown handling

Example production deployment:

```bash
docker run -d \
  --name finance-tracker-prod \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  --memory=512m \
  --cpus=0.5 \
  dfsf5263/finance-tracker:latest
```

## Development Commands

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run check        # Run all checks (lint + format + typecheck)
npm run lint         # ESLint checking
npm run format       # Format code with Biome
npm run format:check # Check code formatting

# Database
npx prisma studio    # Open Prisma Studio
npx prisma migrate dev --name description  # Create new migration
npx prisma db seed   # Seed database with default data
```

## Security Features

Finance Tracker includes enterprise-grade security:

- 🔐 **Authentication & Authorization** - Clerk-based auth with household-level permissions
- 🚦 **Rate Limiting** - Configurable rate limits for all API endpoints
- 🛡️ **Input Validation** - Comprehensive Zod-based validation
- 🔒 **Security Headers** - CSP, HSTS, XSS protection, and more
- 🕒 **Session Management** - Automatic timeout with user warnings
- 📝 **Audit Logging** - Request/response sanitization and error tracking
- 🚫 **CORS Protection** - Restricted cross-origin access
- 🐳 **Container Security** - Secrets never built into images, runtime-only

## Architecture

- **Frontend**: Server-side rendered React with App Router
- **Backend**: Next.js API routes with middleware protection
- **Database**: PostgreSQL with Prisma for type-safe queries
- **Authentication**: Clerk for user management and sessions
- **Deployment**: Containerized with Docker for production

## Documentation

- 📚 [Docker Deployment Guide](docs/DOCKER_DEPLOYMENT.md) - Complete containerization guide
- 🔒 [Session Configuration](docs/SESSION_CONFIGURATION.md) - Session timeout setup
- 🛡️ [Security Documentation](SECURITY_TODO.md) - Security features and roadmap

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code passes all checks:
```bash
npm run check
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 Check the documentation in the `docs/` directory
- 🐛 Report issues on GitHub
- 💬 Start a discussion for questions and feature requests

---

**Production Ready**: This application includes comprehensive security, monitoring, and deployment features suitable for production use.
