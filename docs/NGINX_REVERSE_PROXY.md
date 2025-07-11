# Nginx Reverse Proxy Configuration for Finance Tracker

This document provides the complete nginx configuration for running the Finance Tracker application behind a reverse proxy.

## Prerequisites

- Finance Tracker running in Docker on port 3000
- Nginx installed on the host system
- SSL certificates (for HTTPS configuration)

## Complete Nginx Configuration

```nginx
# HTTP server - redirects to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server - main configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers (some are already set by Next.js middleware)
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Main application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support (required for Clerk real-time features)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Essential headers for proper operation
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Clerk authentication headers
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable buffering for real-time features
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
    
    # CRITICAL: Next.js static assets
    location /_next/static {
        proxy_pass http://localhost:3000/_next/static;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # Cache static assets for performance
        proxy_cache_valid 200 60m;
        proxy_cache_valid 404 1m;
        add_header Cache-Control "public, max-age=3600, immutable";
    }
    
    # Next.js image optimization
    location /_next/image {
        proxy_pass http://localhost:3000/_next/image;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # Cache optimized images
        proxy_cache_valid 200 30d;
        proxy_cache_valid 404 1m;
    }
    
    # Public assets
    location /public {
        proxy_pass http://localhost:3000/public;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # Cache public assets
        add_header Cache-Control "public, max-age=3600";
    }
    
    # API routes (no caching)
    location /api {
        proxy_pass http://localhost:3000/api;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # No caching for API routes
        proxy_cache_bypass 1;
        proxy_no_cache 1;
        
        # Longer timeout for API operations
        proxy_read_timeout 300s;
    }
    
    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        proxy_set_header Host $host;
        access_log off;  # Reduce log noise from health checks
    }
}
```

## Docker Compose Configuration

If using Docker Compose, update the proxy_pass directives to use the container name:

```nginx
# Replace all instances of:
proxy_pass http://localhost:3000;

# With:
proxy_pass http://finance-tracker:3000;
```

## Minimal Configuration

If you prefer a minimal configuration, use this:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
    
    # Essential for Next.js static assets
    location ~ ^/(_next/static|_next/image|favicon.ico) {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_valid 200 60m;
    }
}
```

## Troubleshooting

### 1. No CSS/JavaScript (Plain Text Only)

**Problem**: Page loads but shows only text without styling.

**Solution**: Ensure the `/_next/static` location block is present in your configuration. This is where Next.js serves CSS and JavaScript files.

### 2. Authentication Issues

**Problem**: Clerk authentication not working properly.

**Solutions**:
- Ensure all `X-Forwarded-*` headers are set correctly
- Verify the `Authorization` header is being passed through
- Check that WebSocket support is enabled (Upgrade and Connection headers)

### 3. 502 Bad Gateway Errors

**Problem**: Nginx cannot connect to the application.

**Solutions**:
- Verify the application is running: `docker ps`
- Check the port mapping: `docker port <container-name>`
- If using Docker networks, ensure nginx can reach the container
- Check Docker logs: `docker logs <container-name>`

### 4. Mixed Content Warnings

**Problem**: Browser shows mixed content warnings when using HTTPS.

**Solutions**:
- Ensure `X-Forwarded-Proto https` is set in the proxy headers
- The application uses this header to generate correct URLs

### 5. WebSocket Connection Failed

**Problem**: Real-time features not working (Clerk authentication updates).

**Solution**: Ensure these headers are present:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

## Performance Optimization

### Enable Nginx Caching

Add this to your nginx configuration:

```nginx
# Define cache zone
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=finance_cache:10m max_size=1g inactive=60m use_temp_path=off;

# In your server block
proxy_cache finance_cache;
proxy_cache_revalidate on;
proxy_cache_min_uses 3;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
proxy_cache_background_update on;
proxy_cache_lock on;
```

### Gzip Compression

Add to the http block:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;
```

## Security Considerations

1. **SSL/TLS**: Always use HTTPS in production
2. **Headers**: The configuration includes security headers, but some are already set by the Next.js application
3. **Rate Limiting**: Consider adding rate limiting for API endpoints:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
    # ... rest of configuration
}
```

## Testing Your Configuration

1. Test nginx configuration:
   ```bash
   nginx -t
   ```

2. Reload nginx:
   ```bash
   nginx -s reload
   ```

3. Test static assets are loading:
   ```bash
   curl -I https://your-domain.com/_next/static/css/[hash].css
   ```

4. Check WebSocket connection:
   - Open browser developer tools
   - Go to Network tab
   - Look for WebSocket connections (should show status 101)

## Additional Notes

- The application sets its own CSP (Content Security Policy) headers, so avoid duplicating them in nginx
- The `upgrade-insecure-requests` CSP directive means all resources should be loaded over HTTPS
- Clerk requires specific domains to be whitelisted in the CSP for proper operation