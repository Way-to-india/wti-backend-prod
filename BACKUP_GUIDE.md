# Database Backup Guide

This guide explains how to set up and use the automated database backup system for the Way India backend.

## Overview

The backup system provides:

- **Automated daily backups** using Windows Task Scheduler
- **Backup rotation** (keeps last 30 days by default)
- **Compression** to save disk space
- **Easy restoration** with interactive selection
- **Logging** of all backup operations

## Prerequisites

Ensure you have PostgreSQL client tools installed:

- `pg_dump` - for creating backups
- `psql` - for restoring backups

On Windows, these are typically installed with PostgreSQL.

## Quick Start

### 1. Setup Automated Backups

Run the setup script to create a scheduled task:

```bash
npm run backup:setup
```

This will:

- Create a Windows Task Scheduler task named "WayIndia-DB-Backup"
- Schedule daily backups at 2:00 AM
- Optionally run a test backup immediately

### 2. Manual Backup

To create a backup manually at any time:

```bash
npm run backup:db
```

Backup files are stored in the `backups/` directory with timestamps:

```
backups/
  └── your_database_2025-12-27_23-00-00.sql.zip
```

### 3. Restore from Backup

To restore the database from a backup:

```bash
npm run backup:restore
```

This will:

1. List all available backups
2. Let you select which backup to restore
3. Confirm before overwriting the current database
4. Restore the selected backup

## Backup File Format

Backup files are named with timestamps:

```
{database_name}_{YYYY-MM-DD}_{HH-MM-SS}.sql.{zip|gz}
```

Example: `wayindia_2025-12-27_02-00-00.sql.zip`

## Configuration

### Change Backup Time

Edit the scheduled task in Task Scheduler or re-run setup with a different time:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-backup-schedule.ps1 -BackupTime "03:30"
```

### Change Retention Period

Edit `scripts/backup-database.ts` and modify:

```typescript
const BACKUP_RETENTION_DAYS = 30; // Change this value
```

## Backup Logs

All backup operations are logged to:

```
backups/backup.log
```

Check this file to verify backup success or troubleshoot issues.

## Managing Scheduled Task

### View Task Status

```powershell
Get-ScheduledTask -TaskName "WayIndia-DB-Backup"
```

### Run Task Manually

```powershell
Start-ScheduledTask -TaskName "WayIndia-DB-Backup"
```

### Disable Task

```powershell
Disable-ScheduledTask -TaskName "WayIndia-DB-Backup"
```

### Remove Task

```powershell
Unregister-ScheduledTask -TaskName "WayIndia-DB-Backup" -Confirm:$false
```

## Troubleshooting

### Backup Fails

1. **Check PostgreSQL credentials**: Ensure `.env` file has correct `DATABASE_URL`
2. **Verify pg_dump is installed**: Run `pg_dump --version`
3. **Check permissions**: Ensure the backup directory is writable
4. **Review logs**: Check `backups/backup.log` for error details

### Restore Fails

1. **Check backup file**: Ensure the backup file is not corrupted
2. **Verify psql is installed**: Run `psql --version`
3. **Database connections**: Close all active database connections before restoring
4. **Permissions**: Ensure your database user has restore permissions

### Task Doesn't Run

1. **Check Task Scheduler**: Open `taskschd.msc` and verify the task exists
2. **Review task history**: Check the History tab in Task Scheduler
3. **Test manually**: Run `npm run backup:db` to verify the script works
4. **Check system time**: Ensure your system clock is correct

## Best Practices

1. **Test restores regularly**: Verify backups are working by testing restoration
2. **Monitor disk space**: Backups can grow large over time
3. **Store backups offsite**: Consider copying backups to cloud storage
4. **Review logs**: Periodically check `backup.log` for any issues
5. **Update retention policy**: Adjust based on your storage capacity and needs

## Security Notes

- Backup files contain sensitive data - ensure proper file permissions
- The `.env` file contains database credentials - never commit it to git
- Consider encrypting backups if storing offsite
- Backup files are automatically excluded from git via `.gitignore`

## Manual Backup Commands

If you need to run backup commands directly:

### Create Backup

```bash
pg_dump -h localhost -p 5432 -U username -d database_name -F p -f backup.sql
```

### Restore Backup

```bash
psql -h localhost -p 5432 -U username -d database_name -f backup.sql
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review backup logs in `backups/backup.log`
3. Verify PostgreSQL client tools are installed and accessible
