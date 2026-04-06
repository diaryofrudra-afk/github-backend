# Google OAuth Setup Guide for Suprwise

## Overview

Google OAuth allows users to:
- **Sign up** using their Gmail account (creates owner account automatically)
- **Login** without OTP verification if the email already exists in the database
- Skip OTP entirely for Google-authenticated users

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Enable the **Google+ API**

## Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - **App name**: Suprwise
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes: `email`, `profile`
5. Add test users (during development)

## Step 3: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name**: Suprwise Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**: Leave empty (using popup mode)
5. Click **Create**
6. Copy the **Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)

## Step 4: Configure Backend

Edit `.env` file in `github-backend-main/`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

## Step 5: Configure Frontend

Create `.env` file in `reactcodewebapp-main/`:

```bash
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

## Step 6: Install Backend Dependencies

```bash
cd github-backend-main
pip install google-auth==2.23.4
```

## How It Works

### Sign Up Flow (New User)
1. User clicks "Sign up with Google"
2. Google popup appears
3. User selects their Gmail account
4. Backend verifies Google token
5. Backend creates:
   - New tenant
   - New user (role: owner)
   - Owner profile with Google name
6. User logged in immediately → Fleet dashboard opens

### Login Flow (Existing User)
1. User clicks "Sign in with Google"
2. Google popup appears (or auto-selects if previously authorized)
3. Backend verifies Google token
4. Backend finds user by email
5. User logged in **without OTP** → Dashboard opens

### Key Features
- ✅ **No OTP required** for Google users
- ✅ **Automatic registration** for new users
- ✅ **Email verified** automatically (Google-verified)
- ✅ **One-click login** after initial setup
- ✅ **Works alongside** existing phone OTP system

## Security Notes

- Google tokens are verified server-side using `google-auth` library
- Token validation includes expiry, audience, and signature checks
- Email from Google is marked as verified (bypasses manual verification)
- Google users are created with empty password hash (OTP still works if needed)

## Troubleshooting

### "Google Sign-In is loading"
- Check that `VITE_GOOGLE_CLIENT_ID` is set correctly
- Ensure script loads from `https://accounts.google.com/gsi/client`

### "Invalid Google token"
- Verify `GOOGLE_CLIENT_ID` in backend matches frontend
- Check that the token is being sent correctly

### "Email not provided by Google"
- User denied email permission during OAuth consent
- Ask user to grant email permission

## Migration Path

Existing phone-registered users can:
1. Link Google account later (future feature)
2. Continue using OTP login
3. Both methods can coexist if phone + email are linked

## Production Checklist

- [ ] Google OAuth consent screen approved (not in testing mode)
- [ ] Authorized origins include production domain
- [ ] `GOOGLE_CLIENT_ID` set in production `.env`
- [ ] `VITE_GOOGLE_CLIENT_ID` set in production build
- [ ] Test sign-up flow with new Gmail account
- [ ] Test login flow with existing user
- [ ] Verify email_verified flag is set correctly
