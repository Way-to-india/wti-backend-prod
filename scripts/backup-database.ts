import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const BACKUP_RETENTION_DAYS = 30;
const LOG_FILE = path.join(BACKUP_DIR, 'backup.log');

interface BackupConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Parse DATABASE_URL from .env file
 * Format: postgresql://username:password@host:port/database?params
 */
/**
 * Parse DATABASE_URL from .env file
 * Format: postgresql://username:password@host:port/database?params
 */
function parseDatabaseUrl(): BackupConfig {
  const envPath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);

  if (!dbUrlMatch) {
    throw new Error('DATABASE_URL not found in .env file');
  }

  const dbUrl = dbUrlMatch[1].trim();

  try {
    // Use URL parser for better handling of special characters and query params
    const url = new URL(dbUrl);

    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error('URL must use postgresql:// or postgres:// protocol');
    }

    // Extract database name from pathname (remove leading slash)
    // Split by '?' to remove query parameters if they're in the pathname
    let database = url.pathname.substring(1).split('?')[0];

    // Use default PostgreSQL port if not specified
    const port = url.port && url.port.trim() !== '' ? url.port : '5432';

    // Debug logging
    console.log('Parsed connection details:');
    console.log('Host:', url.hostname);
    console.log('Port:', port);
    console.log('Username:', url.username);
    console.log('Password:', url.password ? '***' : 'missing');
    console.log('Database:', database);

    if (!url.hostname || !url.username || !url.password || !database || !port) {
      throw new Error(
        `Missing required connection parameters - host: ${!!url.hostname}, port: ${!!port}, username: ${!!url.username}, password: ${!!url.password}, database: ${!!database}`
      );
    }

    return {
      host: url.hostname,
      port: port,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: database,
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Log message to console and log file
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  console.log(logMessage);

  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(dbName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  return `${dbName}_${timestamp}.sql`;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(config: BackupConfig): Promise<string> {
  const backupFile = generateBackupFilename(config.database);
  const backupPath = path.join(BACKUP_DIR, backupFile);
  const compressedPath = `${backupPath}.gz`;

  log(`Starting backup for database: ${config.database}`);

  try {
    const env = {
      ...process.env,
      PGPASSWORD: config.password,
    };

    const dumpCommand = `pg_dump -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -F p -f "${backupPath}"`;

    log(
      `Executing: pg_dump -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database}`
    );

    await execAsync(dumpCommand, { env, maxBuffer: 1024 * 1024 * 100 });

    log('Compressing backup file...');
    const gzipCommand =
      process.platform === 'win32'
        ? `powershell -Command "Compress-Archive -Path '${backupPath}' -DestinationPath '${backupPath}.zip' -Force; Remove-Item '${backupPath}'"`
        : `gzip "${backupPath}"`;

    await execAsync(gzipCommand);

    const finalPath = process.platform === 'win32' ? `${backupPath}.zip` : compressedPath;
    const stats = fs.statSync(finalPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    log(`Backup created successfully: ${path.basename(finalPath)} (${sizeInMB} MB)`);

    return finalPath;
  } catch (error) {
    log(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    throw error;
  }
}

/**
 * Remove old backups based on retention policy
 */
function cleanOldBackups(): void {
  log(`Cleaning backups older than ${BACKUP_RETENTION_DAYS} days...`);

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter(
      (file) => file.endsWith('.sql.gz') || file.endsWith('.sql.zip')
    );

    const now = Date.now();
    const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    backupFiles.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath);
        log(`Deleted old backup: ${file}`);
        deletedCount++;
      }
    });

    if (deletedCount === 0) {
      log('No old backups to delete');
    } else {
      log(`Deleted ${deletedCount} old backup(s)`);
    }
  } catch (error) {
    log(`Error cleaning old backups: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main backup function
 */
async function main(): Promise<void> {
  log('='.repeat(60));
  log('Database Backup Started');
  log('='.repeat(60));

  try {
    ensureBackupDir();

    const config = parseDatabaseUrl();

    await createBackup(config);

    cleanOldBackups();

    log('='.repeat(60));
    log('Database Backup Completed Successfully');
    log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    log('='.repeat(60));
    log(`Database Backup Failed: ${error instanceof Error ? error.message : String(error)}`);
    log('='.repeat(60));

    process.exit(1);
  }
}

main();
