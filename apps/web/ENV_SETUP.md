# Environment Variables Setup

## Required for Trading Feature

Add these to your Vercel environment variables:

```bash
# WalletConnect Project ID
# Get from: https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-project-id-here"

# Feature Flag - Enable/Disable Trading UI
NEXT_PUBLIC_ENABLE_TRADING="true"
```

## How to get WalletConnect Project ID:

1. Go to https://cloud.walletconnect.com
2. Sign up / Log in
3. Create new project
4. Copy the Project ID
5. Add to Vercel → Settings → Environment Variables
