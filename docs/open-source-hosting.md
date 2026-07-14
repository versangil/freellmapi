# Open Source Web Hosting Platforms

FreeLLMAPI can be hosted on any open-source web hosting platform or Platform-as-a-Service (PaaS) that supports Docker deployments.

## Requirements

To run FreeLLMAPI, your hosting platform must support:
1. **Docker / Container Deployments**: Ability to pull a pre-built image from `ghcr.io/tashfeenahmed/freellmapi:latest` or build from the provided `Dockerfile`.
2. **Environment Variables**: Ability to securely inject environment variables (specifically `ENCRYPTION_KEY`).
3. **Persistent Storage (Volumes)**: Ability to mount a persistent directory for the SQLite database.

## General Deployment Steps

1. **Set up the Container**:
   - Image: `ghcr.io/tashfeenahmed/freellmapi:latest`
   - Port: Expose port `3001` (HTTP).

2. **Environment Variables**:
   You must set at least the following environment variables:
   - `ENCRYPTION_KEY`: A 64-character hex string. This is required to encrypt provider keys at rest. (Generate with `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `PORT`: (Optional) Defaults to `3001`.
   - `NODE_ENV`: (Optional) Should be set to `production`.

3. **Persistent Storage**:
   - The SQLite database and encrypted keys are stored at `/app/server/data`.
   - You **must** mount a persistent volume to this path. If you do not persist this directory, you will lose your configuration and encrypted provider keys every time the container restarts.
   - **Note**: If you ever change the `ENCRYPTION_KEY`, you will not be able to decrypt the database, so keep it secure and backed up.

## Example Configuration

If your hosting platform supports `docker-compose.yml` or similar file-based configurations, you can adapt the included template:

```yaml
services:
  freellmapi:
    image: ghcr.io/tashfeenahmed/freellmapi:latest
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - NODE_ENV=production
      - PORT=3001
    ports:
      - "3001:3001"
    volumes:
      - freellmapi-data:/app/server/data
    restart: unless-stopped

volumes:
  freellmapi-data:
```
