# Client-Side External Task Sharing

This document describes the client-side implementation of external task sharing using direct Supabase calls instead of serverless functions.

## Overview

External task sharing allows users to generate secure links that external users can access to view and comment on tasks. External users must authenticate with Gmail before accessing shared tasks.

## Architecture

### Frontend Components

1. **useExternalTaskShare Composable** (`src/composables/useExternalTaskShare.js`)
   - Provides all external sharing functionality
   - Handles token generation, link creation, and access validation
   - Manages external comments and task access

2. **DetailedTaskViewCt.vue** 
   - Updated to use the composable instead of API calls
   - Provides UI for generating, revoking, and managing external share links

3. **ExternalTaskView.vue**
   - Standalone component for external users
   - Handles Gmail authentication and task viewing
   - Allows external users to add comments

### Database Schema

1. **task_external_shares** table
   - Stores external share records with secure tokens
   - Tracks access counts and expiration dates
   - Manages share status (active/revoked)

2. **task_comments** table
   - Extended with `external_user_email` column
   - Supports comments from external users

### Security Features

1. **Cryptographic Tokens**
   - 256-bit secure tokens generated using `crypto.getRandomValues()`
   - Unique share IDs for each external share

2. **Row Level Security (RLS) Policies**
   - Anonymous users can only access active, non-expired shares
   - External users can only read shared tasks and add comments
   - Internal users can manage their own external shares

3. **Authentication Requirements**
   - External users must authenticate with Gmail
   - Access is validated through token matching
   - Share links expire after 30 days

## Usage

### Creating External Shares

```javascript
const { generateExternalShareLink } = useExternalTaskShare();
const link = await generateExternalShareLink(taskId, userId);
```

### Revoking External Shares

```javascript
const { revokeExternalShareLink } = useExternalTaskShare();
await revokeExternalShareLink(taskId);
```

### External User Access

External users visit URLs in the format:
```
https://app.aiworkspace.pro/external-task/{shareId}?token={token}
```

## Key Benefits

1. **No Serverless Functions**: Reduced complexity and deployment issues
2. **Direct Supabase Integration**: Better performance and reliability
3. **Automatic Security**: RLS policies handle access control
4. **Real-time Updates**: Leverage Supabase real-time capabilities
5. **Cost Effective**: No additional function execution costs

## Implementation Details

### Token Generation
- Uses `crypto.getRandomValues()` for secure random token generation
- 64-character hexadecimal tokens provide 256 bits of entropy

### Access Validation
- Validates share ID and token combination
- Checks expiration dates and share status
- Increments access count on successful validation

### Comment System
- External comments are marked with `external_user_email`
- Internal comments maintain existing `user_id` association
- Comments are filtered and displayed appropriately

## Migration Notes

- Removed all serverless API functions
- Updated vercel.json to remove function configurations
- RLS policies ensure secure access without custom middleware
- Composable pattern provides reusable functionality

## Security Considerations

1. **Token Security**: Tokens are cryptographically secure and unique
2. **Expiration**: Links automatically expire after 30 days
3. **Revocation**: Links can be revoked immediately
4. **Access Logging**: All access attempts are logged
5. **Authentication**: Gmail authentication required for external users 