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
    echo "      --platform PLATFORM       Target platform (default: linux/amd64)"
    echo "  -h, --help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                                       # Basic build"
    echo "  $0 --push                                                # Build and push"
    echo "  $0 --tag dev                                             # Build with dev tag"
    echo "  $0 --platform linux/arm64                               # Build for ARM64"
    echo "  $0 --push --version v1.0.0                              # Build and push with version"
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

log "Building with Better Auth (all configuration provided at runtime)"

if docker build \
    --platform "${PLATFORM}" \
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
echo "    -e BETTER_AUTH_SECRET=\"your-secret-key\" \\"
echo "    -e BETTER_AUTH_URL=\"http://localhost:3000\" \\"
echo "    -e RESEND_API_KEY=\"re_...\" \\"
echo "    -e EMAIL_FROM_ADDRESS=\"noreply@yourdomain.com\" \\"
echo "    ${PRIMARY_TAG}"