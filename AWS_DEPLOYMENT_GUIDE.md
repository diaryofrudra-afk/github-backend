# AWS Deployment Guide: Unified Backend with Role-Based App Routing

## Overview

This guide explains how to deploy the Suprwise application on AWS with:
- **Single unified backend** running on port 8000
- **Two separate React apps** served from one S3 bucket via CloudFront:
  - Owner/Fleet dashboard at `/` 
  - Operator app at `/operator/`
- **Automatic operator redirect**: Operators are seamlessly redirected to the optimized operator app after login

---

## Architecture

```
User Browser
    ↓
CloudFront (https://app.example.com)
    ├─ GET / → S3 (reactcodewebapp-main/index.html)
    ├─ GET /operator/ → S3 (suprwise-operator-app/index.html)
    └─ /api/* → API Gateway → EC2 (Backend on port 8000)
```

### Login Flow

```
1. User lands on https://app.example.com
2. User logs in via AuthPage
3. Backend returns { role: 'owner' | 'operator', token, ... }
4. Frontend checks role:
   - If owner → Stay at / (show owner dashboard)
   - If operator → Redirect to /operator/ (show operator app)
5. Both apps use same JWT token from localStorage
6. Both apps call same backend `/api` endpoint
```

---

## Prerequisites

- AWS account with EC2 and S3 access
- Domain name (or use CloudFront domain)
- SSL certificate (AWS Certificate Manager)
- Docker (optional, for containerized backend)

---

## Step 1: Backend Deployment

### Option A: EC2 Instance (Recommended for Development)

1. **Launch EC2 Instance**
   ```bash
   # Ubuntu 22.04 LTS, t3.micro or larger
   # Security group: Allow port 8000 (backend), port 443 (HTTPS)
   ```

2. **Connect to instance and install dependencies**
   ```bash
   sudo apt update
   sudo apt install -y python3 python3-pip sqlite3
   cd /opt
   git clone https://github.com/yourusername/github-backend.git
   cd github-backend
   pip install -r requirements.txt
   ```

3. **Start backend (with systemd service)**
   ```bash
   # Create /etc/systemd/system/suprwise-backend.service
   [Unit]
   Description=Suprwise Backend
   After=network.target
   
   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/opt/github-backend
   ExecStart=/usr/bin/python3 -m uvicorn suprwise.main:app --host 0.0.0.0 --port 8000
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   
   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable suprwise-backend
   sudo systemctl start suprwise-backend
   sudo systemctl status suprwise-backend
   ```

### Option B: ECS/Fargate (Production)

1. **Create Docker image** (see Dockerfile below)
2. **Push to ECR**
3. **Create ECS service** with Fargate launch type
4. **Configure ALB** to route `/api/*` to ECS service

**Dockerfile**:
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python3", "-m", "uvicorn", "suprwise.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Step 2: Update Backend Configuration

### Update CORS Origins in `.env`

```env
# For EC2 instance (replace with your actual domain)
CORS_ORIGINS=http://localhost:8000,https://app.example.com,https://app.example.com/operator/

# For production, add all possible origins
CORS_ORIGINS=http://localhost:8000,https://app.example.com,https://app.example.com/operator/,https://api.example.com
```

### Update Backend API Endpoint

Update your `.env` or pass as environment variable:
```bash
BACKEND_URL=https://api.example.com  # Or https://app.example.com/api via proxy
```

---

## Step 3: Build React Apps

### Local Build

```bash
./build-apps.sh
```

This creates a `deploy/` directory with the structure:
```
deploy/
├── index.html                    (owner app)
├── assets/                       (owner app assets)
├── operator/
│   ├── index.html               (operator app)
│   └── assets/                  (operator app assets)
```

### Environment Variables for Build

Set these before building:
```bash
# For owner app
VITE_API_BASE=/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# For operator app (same)
VITE_API_BASE=/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## Step 4: S3 Bucket Setup

### Create S3 Bucket

```bash
aws s3 mb s3://suprwise-app-prod --region us-east-1
```

### Enable Static Website Hosting

```bash
aws s3api put-bucket-website \
  --bucket suprwise-app-prod \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "index.html"}
  }'
```

### Upload Built Apps

```bash
# Upload all files from deploy/ to S3
aws s3 sync deploy/ s3://suprwise-app-prod/ --delete --cache-control "max-age=3600"

# Cache index.html files as uncacheable (for fresh app updates)
aws s3 cp deploy/index.html s3://suprwise-app-prod/index.html \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata "max-age=0"

aws s3 cp deploy/operator/index.html s3://suprwise-app-prod/operator/index.html \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata "max-age=0"
```

### Block Public Access (except CloudFront)

```bash
aws s3api put-public-access-block \
  --bucket suprwise-app-prod \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## Step 5: CloudFront Distribution

### Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name suprwise-app-prod.s3.amazonaws.com \
  --origin-access-identity origin-access-identity/cloudfront/XXXXXXX \
  --default-root-object index.html
```

### Configure CloudFront (via AWS Console or CLI)

1. **Origins**
   - S3 bucket: `suprwise-app-prod.s3.amazonaws.com`
   - Restrict access via Origin Access Identity (OAI)

2. **Default Behavior**
   - Path pattern: `/*`
   - Allowed methods: GET, HEAD
   - Cache policy: Managed-CachingDisabled (or custom)
   - Origin request policy: AllViewerExceptHostHeader

3. **Error Pages**
   - 404 → /index.html (for SPA routing)
   - 403 → /index.html (for SPA routing)

4. **Alternate Domain Names (CNAME)**
   - Add: `app.example.com`

5. **SSL Certificate**
   - Request certificate in AWS Certificate Manager for `app.example.com`
   - Attach to CloudFront distribution

### CloudFront Error Page Configuration

Add custom error responses:
```json
{
  "ErrorCode": 404,
  "ResponseCode": "200",
  "ResponsePagePath": "/index.html",
  "ErrorCachingMinTTL": 0
}
```

Repeat for error code 403.

---

## Step 6: API Gateway & ALB Configuration

### Option A: API Gateway (Serverless)

```bash
# Create API Gateway
aws apigatewayv2 create-api \
  --name suprwise-api \
  --protocol-type HTTP \
  --target http://your-ec2-ip:8000

# Create CloudFront origin for API
# Add Origin: api.example.com → API Gateway endpoint
# Path pattern: /api/* → Route to API Gateway origin
```

### Option B: Application Load Balancer (EC2)

1. **Create ALB**
   ```bash
   aws elbv2 create-load-balancer \
     --name suprwise-alb \
     --subnets subnet-xxx subnet-yyy
   ```

2. **Register EC2 backend**
   ```bash
   aws elbv2 register-targets \
     --target-group-arn arn:aws:elasticloadbalancing:... \
     --targets Id=i-xxxxx
   ```

3. **Configure CloudFront**
   - Add ALB as origin for `/api/*` paths
   - Route `/api/*` to ALB origin

---

## Step 7: DNS Configuration

### Update Domain DNS Records

```bash
# If using CloudFront domain directly (no custom domain)
# Share CloudFront domain: d111111abcdef8.cloudfront.net

# If using custom domain via Route 53
aws route53 create-hosted-zone --name example.com
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "app.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d111111abcdef8.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

---

## Step 8: Verify Deployment

### Test Endpoints

```bash
# Test owner app
curl -L https://app.example.com
# Should return HTML with "Welcome back" or login form

# Test operator app
curl -L https://app.example.com/operator/
# Should return HTML with operator app

# Test API
curl https://app.example.com/api/auth/me
# Should return 401 or auth response
```

### Test Login Flow

1. Open https://app.example.com
2. Login as **owner** → Should stay at `/`
3. Logout, login as **operator** → Should redirect to `/operator/`
4. Verify token is shared between apps (check localStorage)

### Verify CORS

```bash
curl -H "Origin: https://app.example.com" \
     -H "Access-Control-Request-Method: GET" \
     https://api.example.com/api/auth/me
# Should return Access-Control-Allow-Origin header
```

---

## Step 9: Monitoring & Maintenance

### CloudWatch Logs

```bash
# Monitor backend logs
aws logs tail /aws/ec2/suprwise-backend --follow

# Monitor CloudFront distribution
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests
```

### Update Apps

```bash
# After code changes:
./build-apps.sh
aws s3 sync deploy/ s3://suprwise-app-prod/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXX \
  --paths "/*"
```

### Database Backups

```bash
# For SQLite (local backup)
aws s3 cp ./data/suprwise.db s3://suprwise-backups/suprwise.db.$(date +%Y%m%d)

# For production, consider migrating to RDS
```

---

## Troubleshooting

### Issue: Operator App 404

**Solution**: Verify CloudFront error pages are configured to return `/operator/index.html` for `/operator/*` paths.

### Issue: CORS Errors

**Solution**: Verify CORS_ORIGINS in `.env` includes your domain.

### Issue: Operator Not Redirecting

**Solution**: 
1. Check browser console for JavaScript errors
2. Verify role is correctly returned from `/auth/me`
3. Check CloudFront cache (invalidate if needed)

### Issue: Assets Not Loading

**Solution**: Verify vite base paths are correct:
- Owner app: `base: '/'`
- Operator app: `base: '/operator/'`

---

## Cost Estimate (Monthly)

- **S3**: ~$1 (minimal storage + requests)
- **CloudFront**: ~$0.50 - $5 (depending on traffic)
- **EC2** (t3.micro): ~$10
- **Data transfer**: ~$0.50 (within AWS)
- **Route 53** (optional): ~$0.50

**Total**: ~$12-16/month for small deployments

---

## Security Best Practices

1. ✅ Enable HTTPS/TLS (CloudFront + ACM)
2. ✅ Block S3 public access
3. ✅ Use OAI for CloudFront → S3
4. ✅ Rotate JWT_SECRET regularly
5. ✅ Enable WAF on CloudFront for DDoS protection
6. ✅ Use IAM roles for EC2 backend (no hardcoded credentials)
7. ✅ Enable CloudTrail for audit logging

---

## Next Steps

1. Deploy backend to EC2 or ECS
2. Build apps with `./build-apps.sh`
3. Create S3 bucket and upload `deploy/` folder
4. Configure CloudFront distribution
5. Set up DNS via Route 53
6. Test login flow for both owner and operator
7. Configure monitoring and alerts
