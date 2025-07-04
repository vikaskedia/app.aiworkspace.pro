# External Sharing Debug Guide

## API Endpoints

The external sharing functionality includes these API endpoints:

1. **Test Endpoint**: `/api/test-external-sharing` (GET/POST)
2. **Generate Link**: `/api/generate-external-share-link` (POST)
3. **Revoke Link**: `/api/revoke-external-share-link` (POST)
4. **Get History**: `/api/get-external-share-history` (GET)
5. **Access Task**: `/api/external-task-access` (GET)
6. **Add Comment**: `/api/external-task-comment` (POST)

## Environment Variables Required

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## CORS Issues

All endpoints include CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Testing

### 1. Test Basic API Functionality
```bash
curl -X GET https://your-domain.vercel.app/api/test-external-sharing
```

### 2. Test CORS Preflight
```bash
curl -X OPTIONS https://your-domain.vercel.app/api/test-external-sharing \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

### 3. Generate External Share Link
```bash
curl -X POST https://your-domain.vercel.app/api/generate-external-share-link \
  -H "Content-Type: application/json" \
  -d '{"taskId": 123, "userId": "user-uuid"}'
```

## Database Tables

Make sure these tables exist:
1. `task_external_shares` - stores external share records
2. `task_comments` with `external_user_email` column

## Migration Order

Run these migrations in order:
1. `20241201000000_create_task_external_shares_table.sql`
2. `20241201000002_add_external_user_email_flexible.sql`

## Common Issues

### 1. 500 Internal Server Error
- Check environment variables are set in Vercel
- Check database migrations are applied
- Check Supabase service role key has correct permissions

### 2. CORS Errors
- Verify `vercel.json` includes API function configurations
- Check all API functions include CORS headers
- Test preflight OPTIONS requests

### 3. Database Errors
- Ensure migrations are applied: `supabase db push`
- Check RLS policies allow service role access
- Verify table constraints don't conflict with existing data

### 4. Token Issues
- Verify crypto.randomBytes is working in serverless environment
- Check token generation and validation logic
- Ensure UUIDs are properly generated

## Debugging Steps

1. **Test the test endpoint first**: `/api/test-external-sharing`
2. **Check Vercel function logs** for detailed error messages
3. **Verify environment variables** in Vercel dashboard
4. **Test database connectivity** with a simple query
5. **Check CORS** with browser developer tools 