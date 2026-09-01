---
title: "File System Operations"
description: "HTTP API for browsing, reading, writing, and uploading files in container volumes."
section: "Daemon"
order: 87
---

# File System Operations

All file operations are served by the AirLink daemon over HTTP. Every request is HMAC-authenticated and validated against a volume root. The daemon exposes a flat namespace rooted at the container's mounted volume.

## Directory Listing

### GET /fs/list

Returns entries in a directory. Results are cached per path for a short window to avoid hammering the filesystem on repeated calls.

| Parameter       | Type   | Required | Description                                  |
| --------------- | ------ | -------- | -------------------------------------------- |
| `path`          | string | yes      | Directory path relative to root              |
| `fileSpecifier` | string | no       | Filter by category from `fileSpecifier.json` |

#### Rate Limit

5 requests per second per container. Exceeding this returns 429.

#### fileSpecifier

The daemon reads `fileSpecifier.json` from the container's config directory. This file maps category names to glob patterns. Clients can request a category to filter listings without downloading the full tree.

```json
{
  "logs": ["*.log", "logs/**"],
  "config": ["*.json", "*.yaml", "*.toml"]
}
```

#### Response

```json
{
  "entries": [
    {
      "name": "data.csv",
      "type": "file",
      "size": 1048576,
      "modified": 1690000000
    },
    { "name": "subdir", "type": "directory" }
  ]
}
```

Directories are listed first, then files, sorted alphabetically within each group.

---

## File Reading

### GET /fs/file/content

Reads and returns a file's contents. The response is the raw file bytes with appropriate `Content-Type`.

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `path`    | string | yes      | File path relative to root      |
| `start`   | int    | no       | Byte offset to start reading    |
| `end`     | int    | no       | Byte offset to stop (exclusive) |

#### Limits

- Maximum file size: 10 MB
- Path is validated against the volume root (path jail)
- If `start` or `end` exceed file bounds, the response is clamped to valid range

---

## File Writing

### POST /fs/file/content

Writes data to a file. Creates the file if it does not exist, overwrites if it does. Parent directories are created automatically.

| Parameter | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `path`    | string | yes      | File path relative to root  |
| `data`    | string | yes      | Base64-encoded file content |

#### Security

- Path is validated against the volume root
- Null bytes in the path are rejected
- Symlink chains are followed with depth limit 10
- On Linux, `openat2` with `RESOLVE_BENEATH` prevents TOCTOU races

---

## File Operations

### DELETE /fs/rm

Deletes a file or directory. The root directory itself is protected and cannot be deleted.

| Parameter | Type   | Required | Description    |
| --------- | ------ | -------- | -------------- |
| `path`    | string | yes      | Path to delete |

Protected paths:

- `/` (volume root)
- `.` (current directory)
- Any path that resolves outside the volume

### POST /fs/rename

Renames or moves a file/directory. Both source and destination must resolve within the same volume. Moving across volume boundaries is not allowed.

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `from`    | string | yes      | Current path |
| `to`      | string | yes      | New path     |

### POST /fs/copy

Copies a file. If the destination already exists, a `-copy` suffix is appended before the extension (e.g., `data.csv` becomes `data-copy.csv`). If that also exists, a numeric suffix is tried (`data-copy-2.csv`, etc.).

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `from`    | string | yes      | Source path      |
| `to`      | string | yes      | Destination path |

### POST /fs/create-empty-file

Creates a zero-byte file. Fails if the file already exists.

| Parameter | Type   | Required | Description         |
| --------- | ------ | -------- | ------------------- |
| `path`    | string | yes      | File path to create |

### POST /fs/mkdir

Creates a directory. Parent directories are created recursively if needed.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `path`    | string | yes      | Directory path to create |

### POST /fs/append-file

Appends data to a file. Uses chunked upload with session tracking for large appends. The connection is kept alive across chunks.

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `path`    | string | yes      | File path to append to        |
| `data`    | string | yes      | Base64-encoded chunk          |
| `session` | string | no       | Session ID for chunked upload |
| `done`    | bool   | no       | `true` to finalize the append |

#### Timeout

60 seconds of inactivity closes the upload session. Any partially appended data is flushed to disk.

---

## Archive Operations

### POST /fs/zip

Creates a zip archive from the specified files. Uses the system `zip` binary (not a library implementation).

| Parameter | Type     | Required | Description              |
| --------- | -------- | -------- | ------------------------ |
| `path`    | string   | yes      | Destination zip path     |
| `files`   | string[] | yes      | List of files to include |

The resulting archive is stored at the given path within the volume.

### POST /fs/unzip

Extracts an archive. Supports tar, zip, rar, and 7z formats.

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `path`    | string | yes      | Archive file path      |
| `dest`    | string | yes      | Extraction destination |

#### Security Checks

Archive entries are validated during extraction:

| Check                              | Action on failure          |
| ---------------------------------- | -------------------------- |
| Entry contains `..`                | Entry is skipped           |
| Entry is absolute path             | Entry is skipped           |
| Entry contains backslash           | Entry is skipped (Windows) |
| Extracted file escapes destination | Extraction is aborted      |

After extraction, the daemon walks the extracted tree and checks for any symlinks that point outside the volume root. Suspicious entries are flagged.

---

## Download System

### GET /fs/download

Serves a file directly. Sets `Content-Disposition: attachment` so the browser prompts a save dialog.

| Parameter | Type   | Required | Description           |
| --------- | ------ | -------- | --------------------- |
| `path`    | string | yes      | File path to download |

### POST /fs/download-token

Generates a one-time token for downloading a file without re-authenticating. Useful for sharing links or handing off to external tools.

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `path`    | string | yes      | File path to authorize |

#### Token Properties

| Property   | Value             |
| ---------- | ----------------- |
| Entropy    | 256 bits (CSPRNG) |
| TTL        | 90 seconds        |
| Usage      | Single-use        |
| Max active | 10,000 tokens     |

The token is consumed on first use. Expired tokens are cleaned up automatically.

### POST /fs/pull

Downloads a file from a public URL and saves it into the volume. The daemon acts as a proxy, so the container never touches the network directly.

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `url`     | string | yes      | Public URL to download from   |
| `path`    | string | yes      | Destination path in volume    |
| `headers` | object | no       | Extra headers for the request |

#### Limits

- Maximum download size: 512 MB
- SSRF protection: internal IPs (loopback, link-local, private, CGNAT, ULA, multicast) are blocked
- DNS resolution is checked before connecting
- HTTP redirects are followed up to 5 hops, each re-checked

#### $ALVKT() Variable Substitution

URLs may contain `$ALVKT()` tokens that are resolved at request time. These reference daemon-injected environment variables. The substitution happens before the HTTP request is made.

Example:

```
https://storage.example.com/data/$ALVKT(AIRLINK_DATA_TOKEN)/export.csv
```

#### ALC (Airlink Local Cache)

The pull operation checks the local cache before making a network request. If the URL has been fetched recently and the response included cache headers, the cached copy is used. Cache entries expire based on the `Cache-Control` or `Expires` headers from the original response.

---

## Upload System

### POST /fs/upload

Uploads a file to the volume. Accepts either base64-encoded data or raw binary body.

| Parameter  | Type   | Required | Description                         |
| ---------- | ------ | -------- | ----------------------------------- |
| `path`     | string | yes      | Destination path                    |
| `data`     | string | no       | Base64-encoded content (if not raw) |
| `mimeType` | string | no       | MIME type hint                      |

When sending raw binary, set `Content-Type` to the appropriate MIME type and omit the `data` parameter. The daemon reads the body stream directly.

For large files, use chunked upload via `POST /fs/append-file` (see above). The append endpoint tracks upload sessions by ID so you can resume interrupted uploads.

---

## Path Safety

Every file operation goes through path validation before execution. This is not optional and cannot be disabled.

### Validation Pipeline

1. **Null byte check** -- any `\0` in the path is an immediate reject
2. **Resolve against volume root** -- the path is joined to the volume root and resolved
3. **Symlink walk** -- symlinks are followed manually up to depth 10; anything deeper is rejected
4. **Boundary check** -- the resolved path must start with the volume root
5. **openat2 (Linux)** -- if available, `openat2` is called with `RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS` to catch TOCTOU races that the walk might miss

### Reject Criteria

| Condition                          | Result |
| ---------------------------------- | ------ |
| Null byte in path                  | 400    |
| Path escapes volume root           | 403    |
| Symlink chain depth > 10           | 403    |
| `openat2` returns EACCES/EINVAL    | 403    |
| Attempting to delete volume root   | 403    |
| Moving file across volume boundary | 400    |

### openat2 Details

On Linux 5.6+, the daemon uses `openat2` via FFI to open files. This provides atomic path resolution with `RESOLVE_BENEATH` (prevents escaping the root) and `RESOLVE_NO_SYMLINKS` (blocks symlink follow). This eliminates TOCTOU vulnerabilities where a symlink could be swapped between the walk step and the open step.

On non-Linux platforms, the symlink walk with depth limit is the primary defense.
