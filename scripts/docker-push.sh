#!/bin/bash
set -e

# Finance Tracker Docker Push Script
# Pushes existing Docker images to Docker Hub

# Configuration
DOCKER_REGISTRY="dfsf5263"
IMAGE_NAME="finance-tracker"
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}"

# Default values
TAG="latest"
VERSION=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with colors
log() {
    echo -e "${BLUE}[PUSH]${NC} $1"
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
    echo "  -t, --tag TAG        Tag to push (default: latest)"
    echo "  -v, --version VER    Version tag to push (in addition to main tag)"
    echo "  -a, --all            Push all available tags"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Push 'latest' tag"
    echo "  $0 --tag dev            # Push 'dev' tag"
    echo "  $0 --version v1.0.0     # Push 'latest' and 'v1.0.0'"
    echo "  $0 --all                # Push all available tags"
}

# Parse command line arguments
PUSH_ALL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -a|--all)
            PUSH_ALL=true
            shift
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

# Check if logged in to Docker Hub
if ! docker info | grep -q "Username:"; then
    warning "Not logged in to Docker Hub. Attempting to login..."
    if ! docker login; then
        error "Docker Hub login failed"
        exit 1
    fi
fi

log "Starting Docker push to Docker Hub"
log "Registry: ${DOCKER_REGISTRY}"
log "Image: ${IMAGE_NAME}"

# Function to push a specific tag
push_tag() {
    local tag_to_push="$1"
    local full_tag="${FULL_IMAGE_NAME}:${tag_to_push}"
    
    # Check if image exists locally
    if ! docker image inspect "${full_tag}" >/dev/null 2>&1; then
        error "Image ${full_tag} not found locally. Build it first with:"
        echo "  ./scripts/docker-build.sh --tag ${tag_to_push}"
        return 1
    fi
    
    log "Pushing ${full_tag}..."
    if docker push "${full_tag}"; then
        success "Successfully pushed: ${full_tag}"
        return 0
    else
        error "Failed to push: ${full_tag}"
        return 1
    fi
}

# Function to get all available local tags
get_local_tags() {
    docker images "${FULL_IMAGE_NAME}" --format "table {{.Tag}}" | grep -v "TAG" | grep -v "<none>"
}

# Push logic
if [ "$PUSH_ALL" = true ]; then
    log "Pushing all available tags..."
    
    # Get all local tags
    local_tags=$(get_local_tags)
    
    if [ -z "$local_tags" ]; then
        error "No local images found for ${FULL_IMAGE_NAME}"
        echo "Build images first with: ./scripts/docker-build.sh"
        exit 1
    fi
    
    echo "Found local tags:"
    echo "$local_tags"
    echo ""
    
    # Push each tag
    failed_pushes=0
    while IFS= read -r tag; do
        if ! push_tag "$tag"; then
            failed_pushes=$((failed_pushes + 1))
        fi
    done <<< "$local_tags"
    
    if [ $failed_pushes -gt 0 ]; then
        error "$failed_pushes tag(s) failed to push"
        exit 1
    fi
else
    # Push specific tags
    if ! push_tag "$TAG"; then
        exit 1
    fi
    
    # Push version tag if specified
    if [ -n "$VERSION" ]; then
        if ! push_tag "$VERSION"; then
            exit 1
        fi
    fi
fi

success "All pushes completed successfully!"

# Show available images on Docker Hub
echo ""
echo "Images are now available on Docker Hub:"
if [ "$PUSH_ALL" = true ]; then
    while IFS= read -r tag; do
        echo "  docker pull ${FULL_IMAGE_NAME}:${tag}"
    done <<< "$(get_local_tags)"
else
    echo "  docker pull ${FULL_IMAGE_NAME}:${TAG}"
    if [ -n "$VERSION" ]; then
        echo "  docker pull ${FULL_IMAGE_NAME}:${VERSION}"
    fi
fi

echo ""
echo "View on Docker Hub: https://hub.docker.com/r/${DOCKER_REGISTRY}/${IMAGE_NAME}"