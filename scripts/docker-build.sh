#!/bin/bash
set -e

# Finance Tracker Docker Build Script
# Builds and optionally pushes the Docker image to Docker Hub

# Configuration
DOCKER_REGISTRY="dfsf5263"
IMAGE_NAME="finance-tracker"
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}"

# Default values
PUSH=false
TAG="latest"
VERSION=""
CLERK_PUBLIC_KEY=""
PLATFORM="linux/amd64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with colors
log() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --push                     Push image to Docker Hub after building"
    echo "  -t, --tag TAG                  Tag for the image (default: latest)"
    echo "  -v, --version VER              Version tag (will create additional tag)"
    echo "  -k, --clerk-key KEY            Clerk publishable key (required)"
    echo "      --platform PLATFORM       Target platform (default: linux/amd64)"
    echo "  -h, --help                     Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   Clerk publishable key (alternative to --clerk-key)"
    echo ""
    echo "Examples:"
    echo "  $0 --clerk-key pk_live_...                              # Build with explicit key"
    echo "  $0 --push --clerk-key pk_live_...                       # Build and push"
    echo "  $0 --tag dev --clerk-key pk_live_...                    # Build with dev tag"
    echo "  $0 --platform linux/arm64 --clerk-key pk_live_...       # Build for ARM64"
    echo "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... $0 --push # Build with env var"
    echo ""
    echo "Note: Clerk publishable key must be explicitly provided (no .env.local fallback)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--push)
            PUSH=true
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -k|--clerk-key)
            CLERK_PUBLIC_KEY="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate Docker is available
if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    error "Dockerfile not found. Are you in the project root directory?"
    exit 1
fi

log "Starting Docker build for Finance Tracker"
log "Registry: ${DOCKER_REGISTRY}"
log "Image: ${IMAGE_NAME}"
log "Tag: ${TAG}"
if [ -n "$VERSION" ]; then
    log "Version: ${VERSION}"
fi
log "Platform: ${PLATFORM}"
log "Push to registry: ${PUSH}"

# Build the Docker image
log "Building Docker image..."
PRIMARY_TAG="${FULL_IMAGE_NAME}:${TAG}"

# Determine Clerk public key (from command line or environment)
if [ -n "$CLERK_PUBLIC_KEY" ]; then
    # Use key provided via command line
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLIC_KEY"
elif [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    # No key provided via command line or environment
    error "Missing required Clerk public key"
    echo ""
    echo "Provide the Clerk publishable key using one of these methods:"
    echo "  1. Command line: $0 --clerk-key pk_live_..."
    echo "  2. Environment:  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... $0"
    echo ""
    echo "Note: .env.local is not used to prevent accidental environment mixing"
    echo "Note: CLERK_SECRET_KEY is only needed at runtime, not during build"
    exit 1
fi

# Validate the key format
if [[ ! "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_(test_|live_) ]]; then
    error "Invalid Clerk publishable key format"
    echo "Expected format: pk_test_... or pk_live_..."
    echo "Provided: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:0:10}..."
    exit 1
fi

log "Building with Clerk public key (secret keys provided at runtime only)"

if docker build \
    --platform "${PLATFORM}" \
    --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}" \
    -t "${PRIMARY_TAG}" .; then
    success "Docker image built successfully: ${PRIMARY_TAG}"
else
    error "Docker build failed"
    exit 1
fi

# Create version tag if specified
if [ -n "$VERSION" ]; then
    VERSION_TAG="${FULL_IMAGE_NAME}:${VERSION}"
    log "Creating version tag: ${VERSION_TAG}"
    
    if docker tag "${PRIMARY_TAG}" "${VERSION_TAG}"; then
        success "Version tag created: ${VERSION_TAG}"
    else
        error "Failed to create version tag"
        exit 1
    fi
fi

# Push to Docker Hub if requested
if [ "$PUSH" = true ]; then
    log "Pushing images to Docker Hub..."
    
    # Check if logged in to Docker Hub
    if ! docker info | grep -q "Username:"; then
        warning "Not logged in to Docker Hub. Attempting to login..."
        if ! docker login; then
            error "Docker Hub login failed"
            exit 1
        fi
    fi
    
    # Push primary tag
    log "Pushing ${PRIMARY_TAG}..."
    if docker push "${PRIMARY_TAG}"; then
        success "Successfully pushed: ${PRIMARY_TAG}"
    else
        error "Failed to push: ${PRIMARY_TAG}"
        exit 1
    fi
    
    # Push version tag if it exists
    if [ -n "$VERSION" ]; then
        log "Pushing ${VERSION_TAG}..."
        if docker push "${VERSION_TAG}"; then
            success "Successfully pushed: ${VERSION_TAG}"
        else
            error "Failed to push: ${VERSION_TAG}"
            exit 1
        fi
    fi
    
    success "All images pushed successfully to Docker Hub!"
fi

# Show final summary
echo ""
success "Build completed successfully!"
echo "Available tags:"
echo "  - ${PRIMARY_TAG}"
if [ -n "$VERSION" ]; then
    echo "  - ${VERSION_TAG}"
fi

if [ "$PUSH" = true ]; then
    echo ""
    echo "Images are now available on Docker Hub:"
    echo "  docker pull ${PRIMARY_TAG}"
    if [ -n "$VERSION" ]; then
        echo "  docker pull ${VERSION_TAG}"
    fi
fi

echo ""
echo "To run the container locally:"
echo "  docker run -d \\"
echo "    --name finance-tracker \\"
echo "    -p 3000:3000 \\"
echo "    -e DATABASE_URL=\"postgresql://user:pass@host:5432/db\" \\"
echo "    -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\"${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}\" \\"
echo "    -e CLERK_SECRET_KEY=\"sk_live_...\" \\"
echo "    -e CLERK_WEBHOOK_SECRET=\"whsec_...\" \\"
echo "    ${PRIMARY_TAG}"