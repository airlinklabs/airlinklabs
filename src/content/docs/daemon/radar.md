---
title: "Radar Scanner"
description: "Pattern-based file scanner for detecting malicious plugins and modified files."
section: "Daemon"
order: 86
---

# Radar Scanner

## Overview

Radar is a pattern-based file scanner for game server volumes. It detects malicious plugins, modified files, and suspicious patterns across server file systems. The scanner runs on-demand via the AirLink daemon HTTP API and is designed to operate within strict resource limits to avoid impacting host performance.

Key capabilities:

- Filename, extension, and content-based pattern matching
- Configurable security caps for scan depth and resource usage
- Zip export of flagged files for manual review or automated analysis
- Integration with VirusTotal for hash-based threat detection

## Pattern Types

Radar matches files against a list of user-defined patterns. Each pattern has a type that determines how matching works.

| Type        | Match Method                   | Scope               | Use Case                                     |
| ----------- | ------------------------------ | ------------------- | -------------------------------------------- |
| `filename`  | Glob pattern on full path      | File path           | Match specific filenames or path components  |
| `extension` | Glob pattern on file extension | File extension only | Match all files with a given extension       |
| `content`   | Regex inside file bytes        | File content        | Detect signatures, strings, or code patterns |

### Filename patterns

Glob syntax against the relative file path. Use `*` for wildcards and `**` for directory traversal.

Examples:

- `**/shell.*` matches any file named "shell" in any subdirectory
- `plugins/**/*.jar` matches all `.jar` files under `plugins/`
- `**/*backdoor*` matches files containing "backdoor" in the name

### Extension patterns

Glob syntax against the file extension only (not the full path). Leading dot is optional.

Examples:

- `.php` or `php` matches all PHP files
- `.exe` matches all executables
- `sh` matches all shell scripts

### Content patterns

Regex patterns applied to file content. The scanner reads file bytes and searches for the pattern.

Examples:

- `eval\(\$_(GET|POST|REQUEST)` detects PHP eval injection
- `base64_decode\(` detects obfuscation attempts
- `Runtime\.getRuntime\(\)\.exec` detects Java command execution

Note: Content patterns are matched against the raw byte stream. Non-text files may produce false matches. The content scan has strict resource limits (see Security Caps).

## Security Caps

Radar enforces hard limits to prevent resource exhaustion during scans.

| Cap                            | Default    | Description                                                  |
| ------------------------------ | ---------- | ------------------------------------------------------------ |
| Max file size for content scan | 10 MB      | Files larger than this are skipped for content matching      |
| Max files per scan             | 20,000     | Total files processed before scan aborts                     |
| Time budget                    | 10 seconds | Scan terminates after this duration regardless of progress   |
| Symlink validation             | Enabled    | Resolved symlink targets must stay within the scanned volume |

### Size guards

Pattern definitions can include optional size filters to skip files outside a target range:

- `size_less_than` — Skip files larger than the given byte count
- `size_greater_than` — Skip files smaller than the given byte count

These are useful for filtering out irrelevant large binaries or tiny placeholder files.

### Symlink safety

Radar resolves all symlinks before scanning. If a symlink points outside the scanned volume root, the scanner skips the target. This prevents path traversal attacks where a symlink inside the volume references files elsewhere on the host.

## Scan Process

### Request

```
POST /radar/scan
```

**Request body:**

```json
{
  "volume": "/path/to/server/volume",
  "patterns": [
    {
      "type": "filename",
      "pattern": "**/shell.*"
    },
    {
      "type": "content",
      "pattern": "eval\\($_(GET|POST|REQUEST)"
    },
    {
      "type": "extension",
      "pattern": ".php",
      "size_less_than": 1048576
    }
  ]
}
```

**Fields:**

| Field                          | Type    | Required | Description                                |
| ------------------------------ | ------- | -------- | ------------------------------------------ |
| `volume`                       | string  | Yes      | Absolute path to the server volume to scan |
| `patterns`                     | array   | Yes      | List of pattern objects to match against   |
| `patterns[].type`              | string  | Yes      | One of: `filename`, `extension`, `content` |
| `patterns[].pattern`           | string  | Yes      | The glob or regex pattern                  |
| `patterns[].size_less_than`    | integer | No       | Skip files larger than this byte count     |
| `patterns[].size_greater_than` | integer | No       | Skip files smaller than this byte count    |

### Response

```json
{
  "status": "completed",
  "files_scanned": 3847,
  "matches": [
    {
      "path": "plugins/EssentialsX.jar",
      "pattern": {
        "type": "extension",
        "pattern": ".jar"
      },
      "size": 2048576,
      "hash": "a1b2c3d4e5f6..."
    },
    {
      "path": "plugins/.hidden/backdoor.php",
      "pattern": {
        "type": "content",
        "pattern": "eval\\($_(GET|POST|REQUEST)"
      },
      "size": 4096,
      "hash": "f6e5d4c3b2a1..."
    }
  ],
  "scan_duration_ms": 2340,
  "truncated": false
}
```

**Response fields:**

| Field               | Type    | Description                                        |
| ------------------- | ------- | -------------------------------------------------- |
| `status`            | string  | `completed`, `aborted_timeout`, or `aborted_limit` |
| `files_scanned`     | integer | Total files processed                              |
| `matches`           | array   | Files that matched at least one pattern            |
| `matches[].path`    | string  | Relative path within the volume                    |
| `matches[].pattern` | object  | The pattern that triggered the match               |
| `matches[].size`    | integer | File size in bytes                                 |
| `matches[].hash`    | string  | SHA-256 hash of the file                           |
| `scan_duration_ms`  | integer | Wall-clock time for the scan                       |
| `truncated`         | boolean | True if results were cut short due to caps         |

## Zip Export

Radar can package flagged files into a zip archive for download or downstream analysis.

### Request

```
POST /radar/zip
```

**Request body:**

```json
{
  "volume": "/path/to/server/volume",
  "scan_ids": ["match-1", "match-2"],
  "include_folders": ["plugins", "config"],
  "exclude_folders": ["world", "logs"],
  "max_file_size": 8388608,
  "symlink_follow": false
}
```

### Default folders included

These folders are scanned and included by default if no `include_folders` override is provided:

- `plugins`
- `mods`
- `config`
- `addons`
- `datapacks`

### Excluded folders

The following directories are always excluded from zip export:

- `world*` (all world-related directories)
- `logs`
- `cache`
- `crash-reports`
- `node_modules`
- `.git`

### Scannable extensions

Only files with these extensions are included in the zip:

| Category    | Extensions                   |
| ----------- | ---------------------------- |
| Java        | `.jar`                       |
| Scripts     | `.sh`, `.bat`, `.py`, `.php` |
| Executables | `.exe`, `.dll`, `.so`        |
| Config      | `.json`, `.yml`              |

### Zip constraints

| Constraint              | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Max file size per entry | 8 MB                                                        |
| Symlink handling        | Skipped by default (set `symlink_follow: true` to override) |
| Total archive size      | No hard limit, but large exports will be slow               |

### Symlink safety in zip

When creating the zip archive, Radar resolves all symlinks and verifies the target is within the volume. Symlinks pointing outside the volume are excluded. This prevents an attacker from using a symlink to exfiltrate files from outside the server directory.

## Integration with Panel

Radar is integrated into the AirLink admin panel for direct use from the web interface.

### Admin UI

The panel provides a scan management page where admins can:

- Select a server volume to scan
- Choose or customize pattern sets
- View scan results with file details and hashes
- Download zip exports of flagged files
- Review scan history

### VirusTotal integration

Radar calculates SHA-256 hashes for all matched files. When the panel is configured with a VirusTotal API key, these hashes are automatically checked against the VirusTotal database.

**Behavior:**

- Hashes are checked after scan completion, not during the scan
- Known-malicious files are flagged with a `threat_detected` status
- Results include the VirusTotal detection ratio (e.g., "45/70 engines detected this file")
- Rate limiting is respected (4 requests per minute on free tier)

**Configuration:**

Set the VirusTotal API key in the AirLink daemon config:

```json
{
  "radar": {
    "virustotal_api_key": "your-api-key-here",
    "virustotal_enabled": true
  }
}
```

If no API key is configured, hash checking is skipped and the scan results only include the SHA-256 hash without threat intelligence data.
