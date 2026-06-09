# Aegis Hub Roadmap

Aegis Hub is an actively evolving open-source project. 

## Currently Implemented (Stable)
- [x] Zero-Knowledge Authentication
- [x] E2E Encrypted Password & Notes Manager
- [x] E2E Encrypted File Storage
- [x] E2E Private Chat with ECDH Forward Secrecy
- [x] Integrated TOTP (2FA) Authenticator
- [x] PWA Support (Installable on Mobile/Desktop)
- [x] Basic Admin Dashboard

## Planned / Upcoming Features
- [ ] **Multi-Admin Support:** Allow the primary admin to promote other users.
- [ ] **Data Export/Import:** Allow users to import passwords from CSV (Bitwarden, 1Password) and export their vault securely.
- [ ] **Organization Sharing:** Securely share specific vault folders with other users on the instance using public-key cryptography.
- [ ] **WebAuthn / FIDO2:** Support for Yubikey hardware tokens as a secondary factor for login.
- [ ] **Third-Party Security Audit:** Hire an independent security firm to audit the Go backend and WebCrypto implementation.

*Note: There are no strict ETAs for these features. Aegis Hub is maintained by the community.*
