# Deployment Changes Summary

## Overview
This document summarizes all changes made to support role-based routing of operators and owners to separate apps when deployed on AWS with a single unified backend.

---

## Changes Made

### 1. Backend Configuration

**File**: `.env`
- Updated `CORS_ORIGINS` to include:
  - `http://localhost:8000` (dev backend)
  - `https://example.com` (production owner app)
  - `https://example.com/operator/` (production operator app)
  - Kept existing localhost ports for backward compatibility

**Backend Port**: Unified to **port 8000**
- Both apps now proxy `/api` calls to `http://127.0.0.1:8000`
- Run backend with: `python3 -m uvicorn suprwise.main:app --reload --host 127.0.0.1 --port 8000`

### 2. Owner App (reactcodewebapp-main)

#### File: `vite.config.ts`
- Changed backend port from `8002` → `8000`

```typescript
// Before
target: 'http://127.0.0.1:8002',

// After
target: 'http://127.0.0.1:8000',
```

#### File: `src/App.tsx`
- Added operator redirect logic in `useEffect` that restores session:
  - If user is operator → redirect to `/operator/` with `window.location.href`
  - If user is owner → proceed with normal flow

#### File: `src/components/auth/AuthPage.tsx`
- Added operator redirect in **3 authentication handlers**:
  1. `handleGoogleResponse` (Google OAuth)
  2. `handleSubmit` (Email/Password login)
  3. `handleTestLogin` (Test login)
- Each checks `res.role`:
  - If `operator` → `window.location.href = '/operator/'`
  - If `owner` → proceed with dashboard

### 3. Operator App (suprwise-operator-app)

#### File: `vite.config.ts`
- Changed `base` from `./` to `/operator/`
- Changed backend port from `8001` → `8000`

```typescript
// Before
base: './',
target: 'http://localhost:8001',

// After
base: '/operator/',
target: 'http://127.0.0.1:8000',
```

---

## New Files Created

### 1. `build-apps.sh`
- Automated build script for both apps
- Creates `deploy/` directory with:
  - Owner app at `deploy/` (root)
  - Operator app at `deploy/operator/`
- Usage: `./build-apps.sh`

### 2. `AWS_DEPLOYMENT_GUIDE.md`
- Comprehensive guide for deploying to AWS
- Covers:
  - Architecture overview
  - Backend deployment (EC2 / ECS)
  - S3 bucket setup
  - CloudFront configuration
  - DNS setup
  - Verification steps
  - Troubleshooting
  - Security best practices
  - Cost estimates

### 3. `DEPLOYMENT_CHANGES.md` (This file)
- Summary of all changes
- Quick reference for developers

---

## How It Works

### Login Flow

```
User visits https://example.com/
  ↓
Clicks "Sign In" → AuthPage renders
  ↓
Enters credentials → handleSubmit()
  ↓
Backend validates → returns { role: 'owner'|'operator', token, ... }
  ↓
Frontend checks role:
  ├─ IF operator → window.location.href = '/operator/'
  └─ IF owner → stay at / and show owner dashboard
  ↓
Operator lands on https://example.com/operator/
  ↓
Operator app initializes with shared JWT token
```

### Session Restoration

```
User refreshes page with valid JWT token
  ↓
App.tsx useEffect() calls api.me()
  ↓
Backend returns { role: 'owner'|'operator', ... }
  ↓
Frontend checks role:
  ├─ IF operator → window.location.href = '/operator/'
  └─ IF owner → show owner dashboard
```

---

## Testing Locally

### 1. Start Backend (Port 8000)

```bash
python3 -m uvicorn suprwise.main:app --reload --host 127.0.0.1 --port 8000
```

Update vite proxies point to port 8000 (already done).

### 2. Dev: Run Both Apps in Separate Terminals

**Terminal 1 - Owner App**:
```bash
cd reactcodewebapp-main
npm install
npm run dev
# Runs on http://localhost:5173
# Proxies /api to http://localhost:8000
```

**Terminal 2 - Operator App**:
```bash
cd suprwise-operator-app
npm install
npm run dev
# Runs on http://localhost:5174
# Proxies /api to http://localhost:8000
```

### 3. Test Login Flow

**Test as Owner**:
1. Go to `http://localhost:5173`
2. Login with owner credentials
3. Should stay at `/` and show owner dashboard

**Test as Operator** (in owner app):
1. Go to `http://localhost:5173`
2. Login with operator credentials
3. Should redirect to `http://localhost:5174` (operator app)

### 4. Test Session Restore

1. Login as operator → redirected to operator app
2. Refresh operator app → should stay there (not redirect back)
3. Logout → both apps should clear token

---

## Production Deployment

### Step-by-Step

1. **Build Both Apps**
   ```bash
   ./build-apps.sh
   # Creates deploy/ directory with both apps
   ```

2. **Upload to S3**
   ```bash
   aws s3 sync deploy/ s3://your-bucket/ --delete
   ```

3. **Invalidate CloudFront**
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
   ```

4. **Verify**
   - Visit https://app.example.com
   - Test login as owner (stays at /)
   - Test login as operator (redirects to /operator/)

---

## Environment Variables for Builds

### Owner App (reactcodewebapp-main)
```bash
VITE_API_BASE=/api                    # Default, points to CloudFront /api proxy
VITE_GOOGLE_CLIENT_ID=your-client-id  # From Google Cloud Console
```

### Operator App (suprwise-operator-app)
```bash
VITE_API_BASE=/api                    # Default, points to CloudFront /api proxy
VITE_GOOGLE_CLIENT_ID=your-client-id  # From Google Cloud Console
```

### Backend
```bash
JWT_SECRET=your-secret                # Change in production!
CORS_ORIGINS=...                      # Updated with both app paths
# Add production domain:
# https://app.example.com,https://app.example.com/operator/
```

---

## Breaking Changes

⚠️ **None** - This is a backward-compatible change.

- Dev mode still works with both apps separately
- Backend port unified to 8000 (update your startup scripts)
- Operators will automatically redirect when deployed

---

## Verification Checklist

Before deploying to production:

- [ ] Both vite configs point to port 8000
- [ ] `build-apps.sh` creates `deploy/` with both apps
- [ ] Owner app builds correctly (no errors)
- [ ] Operator app builds correctly (no errors)
- [ ] `deploy/index.html` is owner app entry point
- [ ] `deploy/operator/index.html` is operator app entry point
- [ ] Owner login test: stays at `/` (owner dashboard)
- [ ] Operator login test: redirects to `/operator/`
- [ ] Session restore test: role-based redirect works on refresh
- [ ] CORS headers present for both app domains
- [ ] CloudFront error pages configured (404/403 → /index.html)
- [ ] S3 bucket has OAI-only access (not public)
- [ ] SSL certificate configured for domain
- [ ] DNS points to CloudFront distribution

---

## FAQ

**Q: Why redirect operators instead of showing operator UI in owner app?**
A: The operator app is optimized for mobile (bottom nav, smaller screens). Operators get a better UX with the dedicated app. Plus, it reduces bundle size for owners.

**Q: Can operators still access the owner app?**
A: They're automatically redirected. If they manually navigate to `/`, the AuthPage will redirect them to `/operator/` after login.

**Q: What if I want to keep both apps together?**
A: You could skip the redirect and render both UIs based on role in the same app. This would require merging layouts but is possible.

**Q: Will this work with native Android APK?**
A: Yes! The APK can point to `https://example.com/operator/` as web fallback. Capacitor will still show the native UI.

**Q: How do I roll back if something breaks?**
A: Just revert the git commits:
```bash
git revert HEAD~N  # or
git checkout HEAD~N -- src/
```
Then rebuild and redeploy.

---

## Support

For issues or questions:
1. Check AWS_DEPLOYMENT_GUIDE.md for deployment questions
2. Review this file for changes summary
3. Check git log for what changed when
