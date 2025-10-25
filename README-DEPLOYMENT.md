# Comicra - Production Deployment Guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Tunnel                           │
│                    (cloudflared container)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                        Nginx Reverse Proxy                       │
│              (Handles SSL, Routing, Rate Limiting)               │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Frontend   │  │  Backend API    │  │  Admin Backend  │
│  (React)    │  │  (Express)      │  │  (Express)      │
│  Port 80    │  │  Port 4000      │  │  Port 5000      │
└─────────────┘  └────────┬────────┘  └────────┬────────┘
                          │                     │
                 ┌────────▼─────────────────────▼───────┐
                 │         PostgreSQL Database           │
                 │              Port 5432                │
                 └───────────────────────────────────────┘
```

## 📋 Prerequisites

- **Docker** (version 20.10+) and **Docker Compose** (version 2.0+)
- **Domain name** with DNS access
- **Cloudflare account** (for tunnel setup)
- **Gemini API key** from Google AI Studio
- **Supabase project** (optional - or use local PostgreSQL)

## 🚀 Quick Start (Local Development)

### 1. Clone and Setup

```bash
cd /home/user/webapp
cp .env.production.example .env.production
```

### 2. Configure Environment Variables

Edit `.env.production` with your actual values:

```bash
# Essential variables to configure:
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_32_character_secret_here
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=secure_password_here
POSTGRES_PASSWORD=secure_postgres_password
```

### 3. Build and Run

```bash
# Build all containers
docker-compose build

# Start services (development mode with Supabase Studio)
docker-compose --profile dev up -d

# Or production mode
docker-compose up -d
```

### 4. Access Services

- **Frontend**: http://localhost
- **Backend API**: http://localhost:4000
- **Admin Backend**: http://localhost:5000
- **Supabase Studio** (dev mode): http://localhost:54323
- **PostgreSQL**: localhost:5432

### 5. Create First Admin User

```bash
# Connect to PostgreSQL
docker exec -it comicra-postgres psql -U postgres -d comicra

# Create admin user (after first signup)
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

## 🌐 Production Deployment with Cloudflare Tunnel

### Step 1: Set Up Cloudflare Tunnel

1. **Install cloudflared locally** (one-time setup):
   ```bash
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   cloudflared tunnel login
   ```

3. **Create a tunnel**:
   ```bash
   cloudflared tunnel create comicra
   ```

4. **Get the tunnel token**:
   ```bash
   cloudflared tunnel token comicra
   ```

5. **Add tunnel token to `.env.production`**:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token_here
   ```

6. **Configure tunnel routing** (in Cloudflare dashboard or via CLI):
   ```bash
   # Route your domain to the tunnel
   cloudflared tunnel route dns comicra your-domain.com
   cloudflared tunnel route dns comicra admin.your-domain.com
   ```

### Step 2: Configure SSL Certificates

#### Option A: Use Cloudflare Origin Certificates (Recommended)

1. Go to Cloudflare Dashboard → SSL/TLS → Origin Server
2. Create an Origin Certificate
3. Save the certificate and key:
   ```bash
   mkdir -p nginx/ssl
   # Save certificate
   echo "-----BEGIN CERTIFICATE-----
   ...
   -----END CERTIFICATE-----" > nginx/ssl/cert.pem
   
   # Save private key
   echo "-----BEGIN PRIVATE KEY-----
   ...
   -----END PRIVATE KEY-----" > nginx/ssl/key.pem
   
   chmod 600 nginx/ssl/key.pem
   ```

#### Option B: Use Let's Encrypt (Alternative)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com -d admin.your-domain.com

# Copy to nginx directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### Step 3: Update Configuration Files

1. **Update `nginx/nginx.conf`**:
   ```nginx
   # Replace "your-domain.com" with your actual domain
   server_name your-domain.com;
   ```

2. **Update `.env.production`**:
   ```bash
   DOMAIN=your-domain.com
   ADMIN_DOMAIN=admin.your-domain.com
   VITE_SUPABASE_URL=https://your-domain.com
   CLIENT_ORIGIN=https://your-domain.com
   ```

### Step 4: Deploy with Cloudflare Tunnel

```bash
# Build production images
docker-compose build

# Start with cloudflare profile
docker-compose --profile production --profile cloudflare up -d
```

### Step 5: Verify Deployment

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs -f

# Test endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/ai/health
curl https://admin.your-domain.com/health
```

## 🛠️ Management Commands

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f admin-backend
```

### Database Management

```bash
# Run migrations manually
docker exec -it comicra-postgres psql -U postgres -d comicra -f /docker-entrypoint-initdb.d/20251025_complete_schema.sql

# Backup database
docker exec comicra-postgres pg_dump -U postgres comicra > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker exec -i comicra-postgres psql -U postgres comicra < backup_20231025_120000.sql

# Access PostgreSQL shell
docker exec -it comicra-postgres psql -U postgres -d comicra
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or rebuild specific service
docker-compose build frontend
docker-compose up -d frontend
```

## 📊 Monitoring & Maintenance

### Health Checks

All services have health check endpoints:

- Frontend: `GET /health`
- Backend: `GET /health`
- Admin Backend: `GET /health`
- PostgreSQL: Built-in Docker healthcheck

```bash
# Check health of all services
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 frontend

# With timestamps
docker-compose logs -f --timestamps
```

### Performance Monitoring

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Network usage
docker network inspect comicra-network
```

## 🔒 Security Best Practices

### 1. Environment Variables

- ✅ Never commit `.env.production` to git
- ✅ Use strong passwords (32+ characters)
- ✅ Rotate secrets regularly
- ✅ Use different secrets for dev/staging/production

### 2. Database Security

```sql
-- Create read-only user for analytics
CREATE USER analytics_user WITH PASSWORD 'strong_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;

-- Limit connections
ALTER USER postgres CONNECTION LIMIT 20;
```

### 3. Firewall Configuration

```bash
# Only allow necessary ports (if using direct VM deployment)
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 4. Regular Updates

```bash
# Update Docker images
docker-compose pull

# Rebuild with latest Node.js/Nginx
docker-compose build --pull

# Update system packages
sudo apt-get update && sudo apt-get upgrade
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker-compose logs backend

# Check if port is already in use
sudo lsof -i :4000
sudo netstat -tulpn | grep 4000

# Remove and recreate container
docker-compose rm -f backend
docker-compose up -d backend
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Test connection
docker exec -it comicra-postgres psql -U postgres -c "SELECT version();"

# Check environment variables
docker-compose exec backend env | grep SUPABASE
```

### Cloudflare Tunnel Issues

```bash
# Check cloudflared logs
docker-compose logs cloudflared

# Verify tunnel token
echo $CLOUDFLARE_TUNNEL_TOKEN

# Test tunnel manually
cloudflared tunnel run --token $CLOUDFLARE_TUNNEL_TOKEN comicra
```

### Frontend Build Fails

```bash
# Check build logs
docker-compose build frontend --progress=plain

# Build without cache
docker-compose build --no-cache frontend

# Verify node_modules volume
docker-compose run --rm frontend ls -la /app/node_modules
```

## 📦 Backup Strategy

### Automated Backups

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backups/comicra"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec comicra-postgres pg_dump -U postgres comicra | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup volumes
docker run --rm \
  -v comicra_postgres_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres_data_$DATE.tar.gz /data

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/user/webapp/backup.sh >> /var/log/comicra-backup.log 2>&1
```

## 🔄 CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/user/webapp
            git pull origin main
            docker-compose build
            docker-compose up -d
```

## 📞 Support

- **Documentation**: https://github.com/mk230580/comicra
- **Issues**: https://github.com/mk230580/comicra/issues
- **Email**: support@your-domain.com

## 📄 License

[Your License Here]
