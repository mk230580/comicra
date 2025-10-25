# 🚀 Comicra - Quick Start Guide

Get your Comicra app running in minutes!

## ⚡ Super Quick Start (Local Development)

```bash
# 1. Copy environment file
cp .env.production.example .env.production

# 2. Edit with your API keys
nano .env.production  # or use your favorite editor

# 3. Start development mode
./start.sh dev

# That's it! Access at http://localhost
```

## 📋 What You Need

### Required:
- ✅ **Docker** & **Docker Compose** installed
- ✅ **Gemini API Key** (Get from: https://aistudio.google.com/app/apikey)

### Optional (for production):
- 📧 **Cloudflare Account** (for tunnel)
- 🔐 **SSL Certificates** (or use Cloudflare)
- 🌐 **Domain Name**

## 🔧 Configuration Steps

### 1. Get Your Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### 2. Set Up Environment

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set these essential variables:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=create_32_random_characters_here
ADMIN_EMAIL=admin@youremail.com
ADMIN_PASSWORD=choose_strong_password_here
POSTGRES_PASSWORD=choose_strong_password_here

# Optional (for production domain)
DOMAIN=your-domain.com
ADMIN_DOMAIN=admin.your-domain.com
```

**Generate a secure JWT secret:**
```bash
openssl rand -base64 32
```

### 3. Start the Application

```bash
# Development mode (recommended for testing)
./start.sh dev

# Production mode (with Nginx)
./start.sh prod

# With Cloudflare Tunnel (for internet access)
./start.sh cloudflare
```

## 🌐 Access Your Application

### Development Mode:
- **Main App**: http://localhost
- **API Backend**: http://localhost:4000
- **Admin Panel**: http://localhost:5000
- **Database UI**: http://localhost:54323 (Supabase Studio)

### Production Mode:
- **Main App**: https://your-domain.com
- **Admin Panel**: https://admin.your-domain.com

## 👤 Create Your First Admin User

After starting the app:

1. **Sign up** through the regular frontend (http://localhost)
2. **Connect to database**:
   ```bash
   docker exec -it comicra-postgres psql -U postgres -d comicra
   ```

3. **Make yourself admin**:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   \q
   ```

4. **Login to admin panel**: http://localhost:5000

## 🎯 Common Commands

```bash
# View logs
./start.sh logs

# Check status
./start.sh status

# Stop all services
./start.sh stop

# Restart services
./start.sh restart

# Run database migrations
./start.sh migrate

# Create database backup
./start.sh backup
```

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 80
sudo lsof -i :80

# Kill the process
sudo kill -9 <PID>

# Or use different port (edit docker-compose.yml)
```

### Docker Permission Denied
```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or:
newgrp docker
```

### Database Connection Failed
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify database is running
docker-compose ps postgres
```

### Frontend Build Fails
```bash
# Clear Docker cache and rebuild
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## 🚀 Deploy to Production

### Option 1: Cloudflare Tunnel (Easiest)

1. **Install cloudflared**:
   ```bash
   # Linux
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   
   # macOS
   brew install cloudflared
   ```

2. **Create tunnel**:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create comicra
   cloudflared tunnel token comicra
   ```

3. **Add token to `.env.production`**:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=your_token_here
   ```

4. **Configure DNS** (in Cloudflare dashboard):
   - Add CNAME: `your-domain.com` → `your-tunnel-id.cfargotunnel.com`
   - Add CNAME: `admin.your-domain.com` → `your-tunnel-id.cfargotunnel.com`

5. **Start**:
   ```bash
   ./start.sh cloudflare
   ```

### Option 2: Traditional Server with SSL

1. **Get SSL certificates** (Let's Encrypt):
   ```bash
   sudo certbot certonly --standalone -d your-domain.com -d admin.your-domain.com
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
   ```

2. **Update nginx config** with your domain

3. **Start production**:
   ```bash
   ./start.sh prod
   ```

## 📚 Next Steps

- 📖 Read the full [Deployment Guide](README-DEPLOYMENT.md)
- 🔐 Configure [authentication and subscriptions]
- 📊 Set up [monitoring and backups]
- 🎨 Customize the [frontend theme]

## 🆘 Need Help?

- **Documentation**: README-DEPLOYMENT.md
- **Issues**: https://github.com/mk230580/comicra/issues
- **Community**: [Your Discord/Forum Link]

## 📝 Checklist

Before going live:

- [ ] Changed all default passwords
- [ ] Set up SSL certificates
- [ ] Configured proper domain names
- [ ] Created admin user
- [ ] Tested all features
- [ ] Set up database backups
- [ ] Configured monitoring (optional)
- [ ] Reviewed security settings

---

**You're all set! 🎉** Start creating amazing manga with AI!
