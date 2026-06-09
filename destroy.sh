#!/bin/bash
set -e
RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${RED}======================================================${NC}"
echo -e "${RED} WARNING: AEGIS HUB SELF-DESTRUCT SEQUENCE INITIATED  ${NC}"
echo -e "${RED}======================================================${NC}"
echo -e "This will permanently delete your Aegis Hub instance,"
echo -e "including the database, all user data, files, and keys."
echo -e "This action CANNOT be undone."
echo ""
read -p "Are you absolutely sure you want to destroy Aegis Hub? (Type 'DESTROY' to confirm): " confirm

if [ "$confirm" != "DESTROY" ]; then
    echo -e "${YELLOW}Aborted. Your data is safe.${NC}"
    exit 0
fi

echo -e "${RED}Destroying Aegis Hub...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose down -v --rmi all 2>/dev/null || true
else
    docker compose down -v --rmi all 2>/dev/null || true
fi

echo -e "${YELLOW}Shredding sensitive files...${NC}"
if command -v shred &> /dev/null; then
    [ -f .env ] && shred -u .env
    [ -f frontend/Caddyfile ] && shred -u frontend/Caddyfile
else
    rm -f .env frontend/Caddyfile
fi

echo -e "${RED}Done. Aegis Hub and all its data have been securely erased from this server.${NC}"
echo -e "You can now safely delete the project directory."
