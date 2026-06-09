# Administrator Guide

The first user account created on a fresh Aegis Hub instance is automatically granted **Administrator** privileges. 

## The Admin Dashboard
To access the Admin panel, click the gear/shield icon in the top navigation bar.

The Admin can:
- View high-level statistics (total users, total channels, storage used).
- Disable or Enable public registrations.
- View Audit Logs.
- Delete non-admin user accounts (e.g., to free up usernames or remove malicious actors).

## Registration Control
By default, registration is **Open**. This means anyone who discovers your Aegis Hub URL can create an account and store data on your server.
**Highly Recommended:** Once you and your team/family have registered, navigate to the Admin Dashboard and **Disable Public Registrations**. 

## Limitations of the Admin
Due to the Zero-Knowledge nature of Aegis Hub, the Administrator **cannot**:
- View user passwords or notes.
- Reset user passwords.
- Read messages in private DMs or channels they are not invited to.
- Decrypt user files.

The Administrator role exists purely for instance management and resource control.

## Promoting Other Admins
Currently, the Admin role is exclusively locked to the first registered user. Multi-admin support is scheduled for a future roadmap release.
