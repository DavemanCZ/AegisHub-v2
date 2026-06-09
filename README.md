[README.md](https://github.com/user-attachments/files/28755515/README.md)
# 🛡️ Aegis Hub

Aegis Hub is an open-source, zero-knowledge encrypted personal hub, password manager, and private chat platform. It is designed to be fully self-hosted, ensuring that you maintain complete ownership and control over your data.

**Language / Jazyk:** [English](#english) | [Čeština](#čeština)

---

<a name="english"></a>
## EN English

### Features
- **End-to-End Encryption (E2EE):** All passwords, secure notes, bookmarks, and files are encrypted on the client side using AES-GCM-256 before ever reaching the server.
- **Zero-Knowledge Architecture:** The server never sees your Master Password. It authenticates using an Argon2-derived `auth_token` and stores only the encrypted Vault Key.
- **Private E2EE Chat:** Real-time chat (channels and DMs) with forward secrecy using ECDH (Elliptic Curve Diffie-Hellman). Features inline image decrypt/preview and real-time message unsend.
- **Integrated TOTP 2FA Authenticator:** A built-in authenticator tool to manage your two-factor tokens.
- **PWA Ready:** Install Aegis Hub directly to your mobile device as a native app with push capabilities.


### Quick Start (Docker)

To deploy Aegis Hub on your own server (e.g., VPS or Proxmox VM):

1. **Install Prerequisites (Docker & Git):**
   Aegis Hub requires Docker to run. If you are starting on a fresh Ubuntu server, install it using:
   ```bash
   sudo apt update && sudo apt install git -y
   curl -fsSL https://get.docker.com | sudo sh
   ```

2. **Clone the repository:**
   ```bash
   git clone https://github.com/DavemanCZ/AegisHub-V2.git
   cd AegisHub-V2
   ```
2. **Run the setup script:**
   ```bash
   bash setup.sh
   ```
   *The script will auto-generate secure passwords in `.env`, ask for your domain name, configure Caddy for automatic HTTPS (Let's Encrypt), and spin up the Docker containers.*

3. **Initialize the Admin:**
   Open the website in your browser. The **first** user to register will automatically be granted **Administrator** privileges. From the Admin Panel, you can disable public registration and manage the instance.

### Self-Destruct / Uninstall

To completely and permanently wipe your instance, including all data, keys, and databases, run the self-destruct script from the project directory:
```bash
bash destroy.sh
```
*This action is irreversible.*

### Tech Stack
- **Frontend:** React, TypeScript, Vite, Web Crypto API
- **Backend:** Go (Golang), net/http, Gorilla Mux (SSE), PostgreSQL
- **Infrastructure:** Docker, Docker Compose, Caddy

---

<a name="čeština"></a>
## CZ Čeština

### Funkce
- **End-to-End Šifrování (E2EE):** Všechna hesla, poznámky, záložky a soubory jsou zašifrovány přímo u vás v prohlížeči (klientovi) pomocí AES-GCM-256 ještě předtím, než odejdou na server.
- **Zero-Knowledge Architektura:** Server nikdy nezná vaše Master Heslo. K ověřování používá pouze `auth_token` derivovaný pomocí Argon2 a uchovává pouze váš bezpečně zašifrovaný Trezorový Klíč.
- **Soukromý E2EE Chat:** Real-time komunikace s dopřednou bezpečností přes ECDH. Umožňuje inline zobrazení zašifrovaných médií, sdílení souborů a funkci "Unsend".
- **Zabudovaný 2FA TOTP:** Integrovaný autentikátor pro generování dvoufázových hesel pro cizí platformy.



### Rychlá instalace (Docker)

Instalace Aegis Hub na váš vlastní čistý server nebo Proxmox je díky automatickému instalátoru extrémně jednoduchá:

1. **Nainstalujte předpoklady (Docker & Git):**
   Na čistém serveru musíte mít nainstalovaný Docker a Git. Můžete je nainstalovat pomocí:
   ```bash
   sudo apt update && sudo apt install git -y
   curl -fsSL https://get.docker.com | sudo sh
   ```

2. **Stáhněte si repozitář:**
   ```bash
   git clone https://github.com/DavemanCZ/AegisHub-V2.git
   cd AegisHub-V2
   ```
2. **Spusťte instalátor:**
   ```bash
   bash setup.sh
   ```
   *Skript vám automaticky vygeneruje bezpečná hesla pro databázi, zeptá se na vaši doménu a nastaví Caddy webový server, který za vás vyřídí HTTPS (Let's Encrypt).*

3. **První spuštění (Admin):**
   Otevřete web a zaregistrujte se. **První vytvořený účet získá automaticky roli Administrátora.** Následně můžete v Administraci vypnout veřejné registrace a nastavit si systém podle sebe.

### Self-Destruct / Smazání instance

Pokud potřebujete celou instanci kompletně a nevratně smazat (včetně databáze, klíčů a všech nahraných dat), spusťte ze složky projektu:
```bash
bash destroy.sh
```
*Tato akce je nevratná a funguje jako pojistka pro okamžité zničení dat.*
