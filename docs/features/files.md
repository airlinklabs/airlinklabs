# File Manager

The file manager provides browser-based access to server files through the daemon's file API.

## Operations

| Operation | Method   | Path                                    | Description              |
| --------- | -------- | --------------------------------------- | ------------------------ |
| List      | `GET`    | `/servers/:id/files?path=/`             | List directory contents  |
| Read      | `GET`    | `/servers/:id/files/content?file=/path` | Read file content        |
| Write     | `POST`   | `/servers/:id/files/content`            | Write file content       |
| Delete    | `DELETE` | `/servers/:id/files`                    | Delete file or directory |
| Rename    | `POST`   | `/servers/:id/files/rename`             | Rename file              |
| Mkdir     | `POST`   | `/servers/:id/files/mkdir`              | Create directory         |
| Copy      | `POST`   | `/servers/:id/files/copy`               | Copy file                |
| Zip       | `POST`   | `/servers/:id/files/zip`                | Compress files           |
| Unzip     | `POST`   | `/servers/:id/files/unzip`              | Extract archive          |
| Git Pull  | `POST`   | `/servers/:id/files/pull`               | Pull from git repo       |

## Path Safety

All file paths are validated:

- No null bytes
- No path traversal (`..`)
- Filenames cannot contain `/` or `\`

## Permissions

Sub-users need:

- `files.read` (list and read files)
- `files.write` (write, delete, rename, create directories)

## File Upload

File uploads go through the browser to the daemon. The panel proxies the request. Upload size is limited by the `uploadLimit` setting (default 100MB).

## Git Pull

If the server directory is a git repository, the pull operation fetches and merges the latest changes from the remote. This is useful for servers that track their configuration in git.

## SFTP

In addition to the web file manager, servers support SFTP access. Each server can have SFTP credentials managed through the `SftpCredential` model. SFTP runs on the node's SFTP port (default 3003).

See the SFTP module (`src/modules/user/sftp.ts`) for SFTP credential management.
