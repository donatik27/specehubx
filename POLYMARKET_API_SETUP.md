# Polymarket API Credentials Setup

## 📚 Documentation
- **Authentication Guide**: https://docs.polymarket.com/developers/CLOB/authentication
- **Developer Portal**: https://polymarket.us/developer
- **Builder Profile**: https://docs.polymarket.com/developers/builders/builder-profile

---

## 🔑 Step 1: Generate API Credentials

### 1. Visit Developer Portal
```
https://polymarket.us/developer
```

### 2. Connect Your Wallet
- Click "Connect Wallet"
- Use the same wallet you'll trade with
- Sign the message

### 3. Generate API Key
- Click "Generate API Key"
- **IMPORTANT**: Save your private key immediately!
- It will only be shown ONCE

### 4. Save Your Credentials
You'll receive:
```
API Key ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Private Key: base64-encoded-string-here
```

⚠️ **NEVER commit private key to git!**

---

## 🔧 Step 2: Add to Vercel

### 1. Go to Vercel Dashboard
```
Your Project → Settings → Environment Variables
```

### 2. Add Variables

**Variable 1:**
```
Name: POLYMARKET_API_KEY_ID
Value: [paste your API Key ID]
Environment: Production, Preview, Development
```

**Variable 2:**
```
Name: POLYMARKET_PRIVATE_KEY
Value: [paste your Private Key]
Environment: Production, Preview, Development
```

### 3. Redeploy
- Go to Deployments tab
- Click "Redeploy" on latest deployment
- Or push new commit to trigger deploy

---

## ✅ Step 3: Test Trading

### 1. After Redeploy
- Visit your site
- Connect wallet
- Approve USDC (one-time)

### 2. Place Test Order
- Select YES or NO
- Enter amount ($1 for test)
- Click "Buy Shares"
- **No MetaMask popup** (backend handles it)
- Order submits to Polymarket!

### 3. Verify Order
- Visit: https://polymarket.com/portfolio
- Check "Open Orders" or "Positions"
- Your order should be there!

---

## 🔐 Security Best Practices

### ✅ DO:
- Store credentials in environment variables only
- Use different keys for dev/prod if needed
- Rotate keys periodically
- Monitor API usage

### ❌ DON'T:
- Commit private keys to git
- Share private keys in Slack/email
- Store keys in code
- Use same key across multiple apps

---

## 🐛 Troubleshooting

### "API credentials not configured"
- Check environment variables are set in Vercel
- Redeploy after adding variables
- Check variable names match exactly

### "Invalid signature"
- Private key format might be wrong
- Should be base64-encoded Ed25519 key
- Try regenerating key on Polymarket

### "Order creation failed"
- Check USDC balance sufficient
- Verify wallet is on Polygon network
- Check order parameters valid

---

## 📞 Need Help?

- **Polymarket Discord**: https://discord.gg/polymarket
- **Documentation**: https://docs.polymarket.com
- **Support**: support@polymarket.com

---

## 🎯 Production Checklist

Before going live:

- [ ] API credentials generated
- [ ] Environment variables added to Vercel
- [ ] Test order placed successfully
- [ ] Order visible on Polymarket
- [ ] Private key stored securely
- [ ] `.env.local` added to `.gitignore`
- [ ] No credentials in git history

---

**Ready to trade! 🚀**
