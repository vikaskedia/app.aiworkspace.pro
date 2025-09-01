# Cross-Subdomain Authentication Implementation

This implementation enables seamless authentication across subdomains of `aiworkspace.pro`. When a user logs into `login.aiworkspace.pro`, they will automatically be authenticated on `app.aiworkspace.pro` and other subdomains.

## How It Works

### 1. Cookie Management (`src/utils/authRedirect.ts`)
- Sets cookies with the apex domain (`.aiworkspace.pro`) to share across subdomains
- Handles both localhost development and production environments
- Manages access and refresh tokens in both cookies and localStorage
- Provides utilities for cookie promotion and cleanup

### 2. Session Restoration (`src/plugins/crossSubdomainAuth.js`)
- Automatically restores user sessions from cross-subdomain cookies
- Runs during app initialization to check for existing authentication
- Sets up Supabase session from stored tokens

### 3. Auth State Tracking (`src/auth-tracking.js`)
- Enhanced to handle cross-subdomain cookie management
- Automatically sets/clears cookies on sign-in/sign-out events
- Updates cookies when tokens are refreshed
- Syncs cookies with localStorage for redundancy

### 4. App Integration (`src/main.js`)
- Calls session restoration before mounting the app
- Ensures user is authenticated before the app loads

## Environment Variables

Add these to your `.env` file:

```env
# Cross-subdomain Authentication
VITE_APEX_DOMAIN=aiworkspace.pro
VITE_DEFAULT_POST_LOGIN_URL=/all-workspace
```

## Usage

### For Login Flow
1. User visits `login.aiworkspace.pro`
2. User authenticates via OAuth or email/password
3. Tokens are stored in cross-subdomain cookies
4. User is redirected to `app.aiworkspace.pro`
5. App automatically detects and restores the session

### For App Access
1. User visits `app.aiworkspace.pro`
2. App checks for cross-subdomain cookies
3. If valid tokens exist, session is automatically restored
4. User can access the app without re-authentication

## Cookie Names
- `sb-access-token`: Supabase access token
- `sb-refresh-token`: Supabase refresh token

## Security Features
- Cookies are set with `SameSite=Lax` for CSRF protection
- Secure flag is set for HTTPS environments
- Tokens are stored in both cookies and localStorage for redundancy
- Automatic cleanup on sign-out
- Cookies have a 1-year expiration for persistent authentication

## Development vs Production
- **Localhost**: Uses local cookies without domain restrictions, supports cross-port sharing
- **Production**: Uses `.aiworkspace.pro` domain for cross-subdomain sharing

## Localhost Development
The implementation fully supports localhost development:
- Cookies work across different ports (e.g., `localhost:3000` to `localhost:5173`)
- Enhanced localhost detection (supports `localhost`, `127.0.0.1`, and IP addresses)
- Automatic redirect handling for localhost environments
- Detailed console logging for debugging localhost cookie behavior

## Files Modified/Created
- `src/utils/authRedirect.ts` - Cookie management utilities
- `src/plugins/crossSubdomainAuth.js` - Session restoration plugin
- `src/auth-tracking.js` - Enhanced auth state tracking
- `src/main.js` - App initialization with session restoration
- `src/supabase.js` - Updated cookie configuration
- `src/components/LoginPage.vue` - Uses cross-subdomain OAuth redirect
- `src/components/CallbackPage.vue` - Handles cross-subdomain session setup
