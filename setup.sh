#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# Aegis Hub – Setup Script
# Použití: bash setup.sh
# ════════════════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BLUE}${BOLD}"
echo "    _            _        _   _       _     "
echo "   / \   ___  _ _(_)___  | | | |_   _| |__  "
echo "  / _ \ / _ \| '_| / __| | |_| | | | | '_ \ "
echo " / ___ \  __/| | | \__ \ |  _  | |_| | |_) |"
echo "/_/   \_\___||_| |_|___/ |_| |_|\__,_|_.__/ "
echo -e "${NC}"
echo -e "${BOLD}Aegis Hub – Self-Hosting Setup${NC}"
echo ""

# Check docker & docker-compose
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is not installed. Installing Docker automatically from get.docker.com...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
fi
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker Compose is missing. Installing docker-compose-plugin...${NC}"
    sudo apt-get update
    sudo apt-get install docker-compose-plugin -y
fi
echo -e "${GREEN}✓ Docker and Compose are ready${NC}"

# Create .env if not exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠  .env file already exists. Skipping generation.${NC}"
else
    echo -e "\n${BOLD}Generating .env file with secure random keys...${NC}"

    DB_PASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)

    cat > .env << EOF
# ════════════════════════════════════════════════════
# Aegis Hub – Configuration
# Generated: $(date)
# ════════════════════════════════════════════════════

# Database (PostgreSQL)
POSTGRES_USER=aegis
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=aegis_db

# Backend
DB_USER=aegis
DB_PASSWORD=${DB_PASS}
DB_NAME=aegis_db
JWT_SECRET=${JWT_SECRET}
EOF
    echo -e "${GREEN}✓ .env file generated with secure passwords${NC}"
fi

# Ask for domain
echo ""
echo -e "${BOLD}Domain Configuration:${NC}"
read -p "  Enter your domain (e.g. aegis.example.com): " DOMAIN

if [ -n "$DOMAIN" ]; then
    # Update Caddyfile
    if [ -f "frontend/Caddyfile" ]; then
        # Backup and update domain
        cp frontend/Caddyfile frontend/Caddyfile.bak
        sed -i "s|aegis\..*\..*\s|${DOMAIN} |g" frontend/Caddyfile
        echo -e "${GREEN}✓ Caddyfile updated for domain: ${DOMAIN}${NC}"
    fi
fi

# Build and start
echo ""
echo -e "${BOLD}Starting Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose up -d --build
else
    docker compose up -d --build
fi

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ Aegis Hub was successfully started!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
    echo -e "  🌐 URL: ${BOLD}https://${DOMAIN}${NC}"
else
    echo -e "  🌐 URL: ${BOLD}http://localhost${NC}"
fi
echo ""
echo -e "  ${BOLD}Next Steps:${NC}"
echo -e "  1. Open the application and register the FIRST account"
echo -e "     → This first user will automatically become the permanent, non-deletable Administrator."
echo -e "  2. Login as admin → Administration → Settings"
echo -e "     → set instance name, disable public registrations, etc."
echo -e "  3. Create channels in the Chat section"
echo ""
echo -e "  ${YELLOW}To stop:${NC} docker compose down"
echo -e "  ${YELLOW}For logs:${NC}  docker compose logs -f"
echo -e "  ${YELLOW}To update:${NC} git pull && bash deploy.sh"
echo ""
