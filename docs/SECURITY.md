# Aegis Hub Security Architecture & Threat Model

Aegis Hub is designed from the ground up as a **Zero-Knowledge** and **End-to-End Encrypted (E2EE)** platform. This means that the server never processes, stores, or sees any user data in plaintext.

## Threat Model

**What Aegis Hub protects against:**
- **Server Compromise:** If an attacker gains full root access to the Postgres database or the server filesystem, they will only obtain unusable encrypted data (ciphertext) and derived authentication hashes. 
- **Man-in-the-Middle (MitM):** TLS (via Caddy) encrypts the transport layer, and E2EE encrypts the application layer.
- **Provider Snooping:** The host of the server cannot view your passwords, read your chats, or decrypt your stored files.

**What Aegis Hub DOES NOT protect against (Out of Scope):**
- **Endpoint Compromise:** If a user's client device (browser/OS) is infected with malware, keyloggers, or memory scrapers, their data is compromised.
- **Weak Master Passwords:** If a user chooses an easily guessable master password, an offline brute-force attack on their downloaded encrypted vault key is possible.
- **Phishing:** If a user enters their credentials on a malicious clone of your Aegis Hub domain.

## Cryptographic Flow

The platform relies on modern cryptographic primitives, predominantly utilizing the native **Web Crypto API**.

### 1. Zero-Knowledge Authentication
- The user's **Master Password** is combined with a salt (e.g., username/email) on the client side.
- A cryptographic hash function derives an `auth_token`.
- Only this `auth_token` is transmitted to the Go backend.
- The backend performs an additional hash (e.g., bcrypt) on the `auth_token` before storing it in the database. 
- **Result:** The server never sees the Master Password.

### 2. Vault Encryption (AES-GCM)
- A symmetric **Vault Key** is derived client-side from the Master Password.
- When the user stores an item (password, note, file), the client uses **AES-GCM-256** to encrypt the payload with the Vault Key.
- The ciphertext, along with the Initialization Vector (IV), is sent to the backend.
- **Result:** The backend only stores Base64 encoded ciphertexts.

### 3. E2E Chat (ECDH Forward Secrecy)
- Upon chat initialization, the client generates an **Elliptic Curve Diffie-Hellman (ECDH)** key pair.
- The **Public Key** is uploaded to the backend and distributed to chat partners.
- The **Private Key** is encrypted locally with the Vault Key and stored securely.
- To send a message, the client combines their Private Key with the recipient's Public Key to generate a **Shared Secret**.
- This Shared Secret derives a symmetric AES key used to encrypt the specific message.
- **Result:** Even if the database is compromised, past messages cannot be decrypted without the individual user's Private Key.

---
*Disclaimer: Aegis Hub is currently un-audited by a third-party security firm. Use in mission-critical corporate environments should be preceded by a professional review.*
