#!/bin/sh
set -e

# Database connectivity checker for Docker container startup

# Configuration
MAX_ATTEMPTS=${DB_WAIT_TIMEOUT:-30}
SLEEP_INTERVAL=2
ATTEMPT=1

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [DB-WAIT] $1"
}

# Function to clean DATABASE_URL for psql compatibility
clean_database_url_for_psql() {
    # Remove Prisma-specific query parameters that psql doesn't understand
    # Keep valid PostgreSQL parameters like sslmode, connect_timeout, etc.
    
    local url="$1"
    
    # Split URL into base and query parts
    local base_url="${url%%\?*}"
    local query_string="${url#*\?}"
    
    # If there's no query string, return as-is
    if [ "$base_url" = "$url" ]; then
        echo "$url"
        return
    fi
    
    # Filter out problematic parameters
    local cleaned_params=""
    local temp_file="/tmp/cleaned_params_$$"
    
    # Process each parameter correctly by splitting on & first, then on first = only
    # This avoids the subshell variable scope issue
    echo "$query_string" | tr '&' '\n' > "$temp_file"
    
    while read -r param; do
        # Skip empty lines
        [ -z "$param" ] && continue
        
        # Split on first = only (handles values containing = correctly)
        local key="${param%%=*}"
        local value="${param#*=}"
        
        # Skip if no = found (malformed parameter)
        [ "$key" = "$param" ] && continue
        
        case "$key" in
            schema|connection_limit|pool_timeout)
                # Skip Prisma-specific parameters
                log "🧹 Removing Prisma-specific parameter: ${key}=${value}"
                ;;
            *)
                # Keep valid PostgreSQL parameters
                if [ -n "$cleaned_params" ]; then
                    cleaned_params="${cleaned_params}&${key}=${value}"
                else
                    cleaned_params="${key}=${value}"
                fi
                ;;
        esac
    done < "$temp_file"
    
    # Clean up temp file
    rm -f "$temp_file"
    
    # Reconstruct URL
    if [ -n "$cleaned_params" ]; then
        echo "${base_url}?${cleaned_params}"
    else
        echo "$base_url"
    fi
}

# Function to extract database connection details from DATABASE_URL
parse_database_url() {
    # Extract host and port from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    if [ -z "$DATABASE_URL" ]; then
        log "❌ ERROR: DATABASE_URL environment variable not set"
        log "Please set DATABASE_URL to a valid PostgreSQL connection string"
        log "Example: postgresql://user:password@host:5432/database"
        exit 1
    fi
    
    log "Validating DATABASE_URL format..."
    
    # Check if URL starts with postgresql://
    if ! echo "$DATABASE_URL" | grep -q "^postgresql://"; then
        log "❌ ERROR: DATABASE_URL must start with 'postgresql://'"
        log "Current: ${DATABASE_URL%%://*}://..."
        exit 1
    fi
    
    # Use PostgreSQL client to test connection
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        log "❌ ERROR: Could not parse host and port from DATABASE_URL"
        log "Expected format: postgresql://user:password@host:port/database"
        log "Make sure the URL includes both host and port"
        exit 1
    fi
    
    log "✅ DATABASE_URL format valid"
    log "📍 Target: ${DB_HOST}:${DB_PORT}"
    log "🗄️  Database: ${DB_NAME}"
    
    # Create cleaned URL for psql
    DATABASE_URL_CLEAN=$(clean_database_url_for_psql "$DATABASE_URL")
    if [ "$DATABASE_URL_CLEAN" != "$DATABASE_URL" ]; then
        log "🔧 Cleaned DATABASE_URL for psql compatibility"
    fi
    
    # Test DNS resolution
    log "🔍 Testing DNS resolution for ${DB_HOST}..."
    if ! nslookup "$DB_HOST" >/dev/null 2>&1; then
        log "❌ DNS resolution failed for ${DB_HOST}"
        log "Please check if the hostname is correct and reachable"
    else
        log "✅ DNS resolution successful"
    fi
}

# Function to test database connectivity
test_db_connection() {
    local tcp_error=""
    local psql_error=""
    
    # Test TCP connectivity first
    log "Testing TCP connectivity to ${DB_HOST}:${DB_PORT}..."
    if ! tcp_error=$(nc -z "$DB_HOST" "$DB_PORT" 2>&1); then
        log "❌ TCP connection failed: $tcp_error"
        return 1
    fi
    log "✅ TCP connection successful"
    
    # Test actual PostgreSQL connection using cleaned URL
    log "Testing PostgreSQL connection..."
    if ! psql_error=$(psql "$DATABASE_URL_CLEAN" -c "SELECT 1;" 2>&1); then
        log "❌ PostgreSQL connection failed: $psql_error"
        if echo "$psql_error" | grep -q "invalid URI query parameter"; then
            log "💡 Hint: DATABASE_URL contains query parameters that psql doesn't support"
            log "    Original: ${DATABASE_URL}"
            log "    Cleaned:  ${DATABASE_URL_CLEAN}"
        fi
        return 1
    fi
    log "✅ PostgreSQL connection successful"
    
    return 0
}

# Function to test database connectivity using simple approach
test_simple_connection() {
    local prisma_error=""
    
    log "Testing database connection using Prisma..."
    
    # Use a simple SQL query to test the connection
    if ! prisma_error=$(npx prisma db execute --url "$DATABASE_URL" --stdin 2>&1 <<EOF
SELECT 1;
EOF
    ); then
        log "❌ Prisma connection failed: $prisma_error"
        return 1
    fi
    
    log "✅ Prisma connection successful"
    return 0
}

log ""
log "🔌 Starting database connectivity check..."
log "⏱️  Maximum attempts: $MAX_ATTEMPTS"
log "🔄 Sleep interval: ${SLEEP_INTERVAL}s"
log ""

# Parse the database URL
parse_database_url

# Main connection loop
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    log ""
    log "🔍 Attempt $ATTEMPT/$MAX_ATTEMPTS: Testing database connection..."
    
    # Try the simple connection test first (more reliable)
    if test_simple_connection; then
        log ""
        log "🎉 Database connection successful!"
        log "✅ Ready to proceed with application startup"
        exit 0
    fi
    
    # If that fails, try the more detailed test
    if test_db_connection; then
        log ""
        log "🎉 Database connection successful!"
        log "✅ Ready to proceed with application startup"
        exit 0
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log ""
        log "🚨 FINAL FAILURE: Database connection failed after $MAX_ATTEMPTS attempts"
        log ""
        log "📋 Troubleshooting Checklist:"
        log "  1. ✅ DATABASE_URL format: ${DATABASE_URL%:*}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        log "  2. 🔗 Network: Can the container reach ${DB_HOST}:${DB_PORT}?"
        log "  3. 🏃 Service: Is PostgreSQL running on the target server?"
        log "  4. 🔐 Auth: Are the database credentials correct?"
        log "  5. 🗄️  Database: Does the '${DB_NAME}' database exist?"
        log "  6. 🔥 Firewall: Are there any firewall rules blocking connections?"
        log ""
        log "💡 Quick tests to run on your database server:"
        log "   • telnet ${DB_HOST} ${DB_PORT}"
        log "   • psql '${DATABASE_URL_CLEAN}' -c 'SELECT 1;'"
        if [ "$DATABASE_URL_CLEAN" != "$DATABASE_URL" ]; then
            log ""
            log "🔧 Note: Using cleaned URL for psql (removed Prisma-specific parameters)"
        fi
        log ""
        exit 1
    fi
    
    log "🔄 Connection failed, retrying in ${SLEEP_INTERVAL}s... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep $SLEEP_INTERVAL
    ATTEMPT=$((ATTEMPT + 1))
done

log "❌ Database connection timeout reached"
exit 1