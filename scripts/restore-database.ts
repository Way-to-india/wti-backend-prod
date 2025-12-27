import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

interface BackupConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Parse DATABASE_URL from .env file
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

  const dbUrl = dbUrlMatch[1];
  const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(?:\?.*)?$/;
  const match = dbUrl.match(urlPattern);

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    username: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * List all available backup files
 */
function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backup directory found.');
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR);
  const backupFiles = files
    .filter((file) => file.endsWith('.sql.gz') || file.endsWith('.sql.zip'))
    .sort()
    .reverse(); // Most recent first

  return backupFiles;
}

/**
 * Prompt user to select a backup file
 */
async function selectBackup(backups: string[]): Promise<string> {
  console.log('\nAvailable backups:');
  console.log('='.repeat(60));

  backups.forEach((backup, index) => {
    const filePath = path.join(BACKUP_DIR, backup);
    const stats = fs.statSync(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    const date = stats.mtime.toLocaleString();

    console.log(`${index + 1}. ${backup}`);
    console.log(`   Size: ${sizeInMB} MB | Created: ${date}`);
  });

  console.log('='.repeat(60));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("\nEnter backup number to restore (or 'q' to quit): ", (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'q') {
        console.log('Restoration cancelled.');
        process.exit(0);
      }

      const index = parseInt(answer) - 1;

      if (isNaN(index) || index < 0 || index >= backups.length) {
        console.log('Invalid selection.');
        process.exit(1);
      }

      resolve(backups[index]);
    });
  });
}

/**
 * Decompress backup file
 */
async function decompressBackup(backupFile: string): Promise<string> {
  const backupPath = path.join(BACKUP_DIR, backupFile);
  const isZip = backupFile.endsWith('.zip');
  const decompressedPath = backupPath.replace(isZip ? '.zip' : '.gz', '');

  console.log('Decompressing backup file...');

  try {
    if (isZip) {
      // Windows zip
      const command = `powershell -Command "Expand-Archive -Path '${backupPath}' -DestinationPath '${BACKUP_DIR}' -Force"`;
      await execAsync(command);
    } else {
      // gzip
      const command = `gunzip -c "${backupPath}" > "${decompressedPath}"`;
      await execAsync(command);
    }

    console.log('Decompression complete.');
    return decompressedPath;
  } catch (error) {
    throw new Error(
      `Failed to decompress backup: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Restore database from backup file
 */
async function restoreDatabase(config: BackupConfig, backupPath: string): Promise<void> {
  console.log(`\nRestoring database: ${config.database}`);
  console.log('WARNING: This will overwrite the current database!');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('\nAre you sure you want to continue? (yes/no): ', async (answer) => {
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Restoration cancelled.');
        process.exit(0);
      }

      try {
        const env = {
          ...process.env,
          PGPASSWORD: config.password,
        };

        // Drop existing connections and recreate database
        console.log('Preparing database for restoration...');

        const restoreCommand = `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f "${backupPath}"`;

        console.log('Restoring database...');
        await execAsync(restoreCommand, { env, maxBuffer: 1024 * 1024 * 100 });

        console.log('Database restored successfully!');

        // Clean up decompressed file
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }

        resolve();
      } catch (error) {
        reject(
          new Error(`Restoration failed: ${error instanceof Error ? error.message : String(error)}`)
        );
      }
    });
  });
}

/**
 * Main restore function
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Database Restoration Tool');
  console.log('='.repeat(60));

  try {
    // List available backups
    const backups = listBackups();

    if (backups.length === 0) {
      console.log('No backup files found.');
      process.exit(1);
    }

    // Select backup
    const selectedBackup = await selectBackup(backups);
    console.log(`\nSelected: ${selectedBackup}`);

    // Decompress backup
    const decompressedPath = await decompressBackup(selectedBackup);

    // Parse database configuration
    const config = parseDatabaseUrl();

    // Restore database
    await restoreDatabase(config, decompressedPath);

    console.log('='.repeat(60));
    console.log('Restoration completed successfully!');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('='.repeat(60));
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run the restoration
main();
