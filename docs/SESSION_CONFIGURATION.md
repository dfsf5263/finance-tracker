# Session Configuration Guide

This document describes how to configure session timeouts for the Finance Tracker application.

## Overview

Session management is handled by Clerk, our authentication provider. Session timeouts are configured through the Clerk Dashboard, not through environment variables or code.

## Accessing Session Settings

1. Log in to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your Finance Tracker application
3. Navigate to **Sessions** in the left sidebar
4. You'll see the session configuration options

## Recommended Settings for Financial Applications

For financial applications, we recommend conservative timeout settings to protect sensitive data:

### Inactivity Timeout
- **Recommended**: 30 minutes
- **Purpose**: Automatically logs out users after 30 minutes of inactivity
- **Note**: Our client-side monitor will warn users 5 minutes before timeout

### Maximum Session Lifetime
- **Recommended**: 8 hours
- **Purpose**: Forces re-authentication after 8 hours, even with continuous activity
- **Note**: Helps prevent session hijacking and ensures regular authentication

### Multi-Session Settings
- **Recommended**: Allow multi-session (enabled by default)
- **Purpose**: Users can be logged in on multiple devices
- **Note**: Each session is tracked independently

## How Session Timeouts Work

### Inactivity Timeout
- Clerk tracks the last activity timestamp for each session
- If no API requests are made within the timeout period, the session expires
- Our client-side monitor tracks user interactions (mouse, keyboard, scroll, touch)
- Users receive a warning modal 5 minutes before the session expires

### Maximum Lifetime
- Each session has an absolute expiry time set when created
- Cannot be extended beyond this time
- Users must re-authenticate after this period

## Client-Side Session Monitoring

The application includes a client-side session monitor that:

1. **Tracks User Activity**
   - Mouse movements and clicks
   - Keyboard input
   - Scroll events
   - Touch interactions

2. **Provides Warnings**
   - Shows a modal 5 minutes before inactivity timeout
   - Displays countdown timer
   - Allows users to extend their session

3. **Handles Expiry**
   - Automatically redirects to sign-in page on timeout
   - Clears any sensitive data from memory
   - Shows appropriate messaging to the user

## Security Considerations

### Browser Cookie Limitations
- Modern browsers (Chrome, Safari) limit cookie lifetime to 400 days
- This affects "Remember me" functionality
- Sessions will expire after 400 days regardless of Clerk settings

### Token Security
- Clerk uses secure, httpOnly cookies for session tokens
- Tokens are automatically refreshed before expiry for active users
- No sensitive tokens are stored in localStorage or sessionStorage

### Compliance
- 30-minute inactivity timeout meets most financial compliance requirements
- Consider shorter timeouts for highly sensitive operations
- Document your session timeout policy for audit purposes

## Troubleshooting

### Session Expires Too Quickly
1. Check Clerk Dashboard settings
2. Verify client-side monitor isn't too aggressive
3. Ensure API calls are properly authenticated

### Session Never Expires
1. Verify Clerk session settings are saved
2. Check that client-side code isn't preventing timeout
3. Ensure browser cookies are enabled

### Warning Modal Not Showing
1. Check browser console for errors
2. Verify SessionMonitor component is mounted
3. Ensure activity tracking is working

## Testing Session Timeouts

To test session timeout behavior:

1. **Test Inactivity Timeout**
   - Log in to the application
   - Wait 25 minutes without interaction
   - Verify warning modal appears
   - Wait 5 more minutes
   - Verify automatic logout occurs

2. **Test Activity Extension**
   - Log in and use the application
   - When warning appears, click "Stay Logged In"
   - Verify session continues
   - Verify timeout resets

3. **Test Maximum Lifetime**
   - Note: This requires waiting 8 hours
   - Alternatively, temporarily reduce the setting in Clerk Dashboard
   - Verify logout occurs even with continuous activity

## Related Documentation

- [Clerk Session Documentation](https://clerk.com/docs/authentication/sessions)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [PCI DSS Session Requirements](https://www.pcisecuritystandards.org/)