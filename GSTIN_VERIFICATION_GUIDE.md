# GSTIN Verification Integration Guide

This guide explains how to integrate the GSTIN (Goods and Services Tax Identification Number) verification API into your React web application. When users enter a GST number, they will be able to retrieve and view GST details from the portal.

## Overview

The integration involves:
1. Adding TypeScript types for GST data
2. Creating API service methods to call the GSTIN endpoints (proxied via backend)
3. Building a React component for GST lookup
4. Displaying GST details to users and autofilling forms

---

## Step 1: Add GST Types

Types are located in `src/types/index.ts`.

## Step 2: GST API Service

Service methods are located in `src/services/gst.ts`.

## Step 3: GST Verification Component

The component is located in `src/components/GSTVerification.tsx`.

## Step 4: System-Wide Integration

### Option A: Standalone Verification Page
A dedicated page is available at `src/pages/GSTVerificationPage.tsx` (Route: `/gst-verification`).

### Option B: Integration into Forms (Autofill)
The component can be integrated into any form (like Client creation) to autofill details:

```tsx
import { GSTVerification } from '../components/GSTVerification';

// ... in your form component
const handleGSTVerified = (gstin, details) => {
  setFormData(prev => ({
    ...prev,
    gstin: details.gstin,
    name: details.legal_name,
    address: details.principal_place_of_business.address,
    city: details.principal_place_of_business.city,
    state: details.principal_place_of_business.state
  }));
};
```

---

## Step 5: Backend Proxy

To keep the API key secure, all requests are proxied through the backend:
- Endpoint: `POST /api/gst/verify`
- Endpoint: `POST /api/gst/filing-status`

Backend implementation is in `suprwise/gst/router.py`.

---

## Step 6: Environment Variables

Add to your `.env` file:
```env
GST_VERIFICATION_API_KEY=04171078fc8a047afef2e227f405c4fb
```
