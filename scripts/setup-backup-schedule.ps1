# Database Backup Scheduler Setup Script
# This script creates a Windows Task Scheduler task to run daily database backups

param(
    [string]$BackupTime = "02:00"
)

# Get the project root directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ScriptPath = Join-Path $ProjectRoot "scripts\backup-database.ts"
$NodePath = (Get-Command node).Source
$BunPath = (Get-Command bun -ErrorAction SilentlyContinue).Source

# Determine which runtime to use
if ($BunPath) {
    $Runtime = $BunPath
    $RuntimeName = "Bun"
} elseif ($NodePath) {
    $Runtime = $NodePath
    $RuntimeName = "Node.js"
} else {
    Write-Host "Error: Neither Node.js nor Bun found in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "Way India - Database Backup Scheduler Setup" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Yellow
Write-Host "Backup Script: $ScriptPath" -ForegroundColor Yellow
Write-Host "Runtime: $RuntimeName ($Runtime)" -ForegroundColor Yellow
Write-Host "Scheduled Time: $BackupTime daily" -ForegroundColor Yellow
Write-Host ""

# Check if script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "Error: Backup script not found at $ScriptPath" -ForegroundColor Red
    exit 1
}

# Task details
$TaskName = "WayIndia-DB-Backup"
$TaskDescription = "Daily automated database backup for Way India backend"

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Task '$TaskName' already exists." -ForegroundColor Yellow
    $Response = Read-Host "Do you want to replace it? (yes/no)"
    
    if ($Response -ne "yes") {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Existing task removed." -ForegroundColor Green
}

# Create the action
$Action = New-ScheduledTaskAction `
    -Execute $Runtime `
    -Argument "run `"$ScriptPath`"" `
    -WorkingDirectory $ProjectRoot

# Create the trigger (daily at specified time)
$Trigger = New-ScheduledTaskTrigger -Daily -At $BackupTime

# Create settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -DontStopOnIdleEnd

# Get current user
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description $TaskDescription `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Force | Out-Null
    
    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "SUCCESS! Scheduled task created successfully." -ForegroundColor Green
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: $TaskName" -ForegroundColor Cyan
    Write-Host "Schedule: Daily at $BackupTime" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can manage this task in:" -ForegroundColor Yellow
    Write-Host "  - Task Scheduler (taskschd.msc)" -ForegroundColor Yellow
    Write-Host "  - Or run: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To test the backup manually, run:" -ForegroundColor Yellow
    Write-Host "  npm run backup:db" -ForegroundColor Yellow
    Write-Host ""
    
    # Ask if user wants to run a test backup now
    $TestNow = Read-Host "Would you like to run a test backup now? (yes/no)"
    
    if ($TestNow -eq "yes") {
        Write-Host ""
        Write-Host "Running test backup..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "Test backup started. Check the backups folder for results." -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor Red
    Write-Host "ERROR: Failed to create scheduled task" -ForegroundColor Red
    Write-Host "==============================================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
