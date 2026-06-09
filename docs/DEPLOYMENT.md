# Deployment & Hardening Guide

Aegis Hub is containerized for simple and isolated deployments using Docker.

## Recommended Production Setup
- **OS:** Fresh Ubuntu LTS or Debian.
- **Hardware:** Minimum 1GB RAM, 1 CPU Core.
- **Network:** Only expose ports 80 and 443 to the internet.

## Infrastructure
The default `docker-compose.yml` provisions:
1. **Frontend:** Serves static React/Vite assets via Nginx.
2. **Backend:** Go REST & SSE API.
3. **Database:** PostgreSQL instance, completely shielded from the host network.
4. **Reverse Proxy (Caddy):** Automatically provisions Let's Encrypt TLS certificates.

## Security Hardening
To secure your Aegis Hub VPS, we strongly recommend implementing the following:

1. **Firewall (UFW):**
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```

2. **Disable Root SSH:**
   Configure `/etc/ssh/sshd_config` to `PermitRootLogin no` and use SSH keys instead of passwords.

3. **Fail2Ban:**
   Install `fail2ban` to protect your SSH port from brute-force attempts.

4. **Database Exposure:**
   Do NOT map the Postgres port (5432) to the host in your docker-compose file. The backend communicates with it via the internal Docker network.

5. **Regular Updates:**
   Keep the host OS up to date (`apt upgrade`) and pull the latest Aegis Hub Docker images regularly.
