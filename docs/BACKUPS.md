# Backup & Recovery

Aegis Hub stores all its data, including user accounts, encrypted vaults, messages, and uploaded files, inside a PostgreSQL database and Docker volumes.

## What to Backup
The critical component to back up is the database volume.

To perform a manual backup of the Postgres database:
```bash
docker exec -t aegis-db pg_dumpall -c -U aegis > aegis_backup_$(date +%F).sql
```
Store this `.sql` file securely off-site.

## How to Restore
On a fresh installation with an empty database:
```bash
cat aegis_backup_YOURDATE.sql | docker exec -i aegis-db psql -U aegis -d aegis_db
```

## Disaster Scenarios

**Lost Server / Corrupted Drive:**
If you lose your server but have the `.sql` backup, you can spin up a new instance using the standard `setup.sh` and restore the `.sql` dump. All user passwords and encrypted data will seamlessly resume working.

**Lost Master Password:**
Aegis Hub operates on a Zero-Knowledge architecture. **If a user forgets their Master Password, their data is permanently irretrievable.** The server Administrator CANNOT reset passwords or decrypt vaults for users. The only resolution is to delete the account and start over.

**Lost Server + No Backup:**
Total data loss. We recommend setting up a cron job to automatically export and encrypt the `pg_dumpall` output to remote storage (e.g., AWS S3, Nextcloud, or a local NAS).
