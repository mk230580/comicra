#!/bin/bash

# Comicra Docker Deployment Script
# Usage: ./start.sh [dev|prod|cloudflare|stop|restart|logs]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}     Comicra Deployment Script      ${NC}"
echo -e "${GREEN}=====================================${NC}"

# Function to check if .env.production exists
check_env() {
    if [ ! -f .env.production ]; then
        echo -e "${RED}Error: .env.production file not found${NC}"
        echo -e "${YELLOW}Creating from template...${NC}"
        if [ -f .env.production.example ]; then
            cp .env.production.example .env.production
            echo -e "${GREEN}Created .env.production from template${NC}"
            echo -e "${YELLOW}Please edit .env.production with your actual values before continuing${NC}"
            exit 1
        else
            echo -e "${RED}Error: .env.production.example not found${NC}"
            exit 1
        fi
    fi
}

# Function to check Docker installation
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        echo -e "${YELLOW}Please install Docker first: https://docs.docker.com/get-docker/${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        echo -e "${YELLOW}Please install Docker Compose first: https://docs.docker.com/compose/install/${NC}"
        exit 1
    fi
}

# Function to start development mode
start_dev() {
    echo -e "${GREEN}Starting Comicra in Development Mode...${NC}"
    check_env
    check_docker
    
    docker-compose --profile dev up -d
    
    echo -e "${GREEN}✅ Development services started!${NC}"
    echo ""
    echo -e "Access your services:"
    echo -e "  Frontend:         ${GREEN}http://localhost${NC}"
    echo -e "  Backend API:      ${GREEN}http://localhost:4000${NC}"
    echo -e "  Admin Backend:    ${GREEN}http://localhost:5000${NC}"
    echo -e "  Supabase Studio:  ${GREEN}http://localhost:54323${NC}"
    echo -e "  PostgreSQL:       ${GREEN}localhost:5432${NC}"
    echo ""
    echo -e "View logs: ${YELLOW}docker-compose logs -f${NC}"
}

# Function to start production mode
start_prod() {
    echo -e "${GREEN}Starting Comicra in Production Mode...${NC}"
    check_env
    check_docker
    
    # Check if SSL certificates exist
    if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
        echo -e "${YELLOW}Warning: SSL certificates not found in nginx/ssl/${NC}"
        echo -e "${YELLOW}Nginx may fail to start. Please add certificates or use Cloudflare mode.${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    docker-compose --profile production up -d
    
    echo -e "${GREEN}✅ Production services started!${NC}"
    echo ""
    echo -e "Access your services:"
    echo -e "  Frontend:         ${GREEN}https://your-domain.com${NC}"
    echo -e "  Backend API:      ${GREEN}https://your-domain.com/api${NC}"
    echo -e "  Admin Panel:      ${GREEN}https://admin.your-domain.com${NC}"
    echo ""
    echo -e "View logs: ${YELLOW}docker-compose logs -f${NC}"
}

# Function to start with Cloudflare Tunnel
start_cloudflare() {
    echo -e "${GREEN}Starting Comicra with Cloudflare Tunnel...${NC}"
    check_env
    check_docker
    
    # Check if CLOUDFLARE_TUNNEL_TOKEN is set
    source .env.production
    if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
        echo -e "${RED}Error: CLOUDFLARE_TUNNEL_TOKEN not set in .env.production${NC}"
        echo -e "${YELLOW}Please configure Cloudflare Tunnel first${NC}"
        echo -e "${YELLOW}See README-DEPLOYMENT.md for instructions${NC}"
        exit 1
    fi
    
    docker-compose --profile production --profile cloudflare up -d
    
    echo -e "${GREEN}✅ Services started with Cloudflare Tunnel!${NC}"
    echo ""
    echo -e "Your site should be accessible via Cloudflare Tunnel"
    echo -e "Check tunnel status: ${YELLOW}docker-compose logs cloudflared${NC}"
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}Stopping all Comicra services...${NC}"
    docker-compose --profile dev --profile production --profile cloudflare down
    echo -e "${GREEN}✅ All services stopped${NC}"
}

# Function to restart services
restart_services() {
    echo -e "${YELLOW}Restarting Comicra services...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Services restarted${NC}"
}

# Function to show logs
show_logs() {
    echo -e "${GREEN}Showing logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f
}

# Function to show status
show_status() {
    echo -e "${GREEN}Service Status:${NC}"
    docker-compose ps
}

# Function to run database migrations
run_migrations() {
    echo -e "${GREEN}Running database migrations...${NC}"
    docker exec -it comicra-postgres psql -U postgres -d comicra -f /docker-entrypoint-initdb.d/20251025_complete_schema.sql
    echo -e "${GREEN}✅ Migrations completed${NC}"
}

# Function to create backup
create_backup() {
    echo -e "${GREEN}Creating backup...${NC}"
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    DATE=$(date +%Y%m%d_%H%M%S)
    
    docker exec comicra-postgres pg_dump -U postgres comicra > "$BACKUP_DIR/backup_$DATE.sql"
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_DIR/backup_$DATE.sql${NC}"
}

# Main script logic
case "$1" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    cloudflare)
        start_cloudflare
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    migrate)
        run_migrations
        ;;
    backup)
        create_backup
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 {dev|prod|cloudflare|stop|restart|logs|status|migrate|backup}${NC}"
        echo ""
        echo -e "Commands:"
        echo -e "  ${GREEN}dev${NC}         - Start in development mode with Supabase Studio"
        echo -e "  ${GREEN}prod${NC}        - Start in production mode with Nginx"
        echo -e "  ${GREEN}cloudflare${NC}  - Start with Cloudflare Tunnel"
        echo -e "  ${GREEN}stop${NC}        - Stop all services"
        echo -e "  ${GREEN}restart${NC}     - Restart all services"
        echo -e "  ${GREEN}logs${NC}        - Show logs from all services"
        echo -e "  ${GREEN}status${NC}      - Show service status"
        echo -e "  ${GREEN}migrate${NC}     - Run database migrations"
        echo -e "  ${GREEN}backup${NC}      - Create database backup"
        echo ""
        exit 1
        ;;
esac
