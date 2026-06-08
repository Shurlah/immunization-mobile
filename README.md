# Immunization Mobile

React Native offline-first client for health workers.

Implemented foundation:

- Secure token storage through `react-native-encrypted-storage`.
- Local SQLite schema for children, guardians, immunizations, appointments, facilities, vaccines, `SyncQueue`, and `SyncState`.
- Offline child registration writes local data first and creates durable sync queue items.
- Manual/network-triggered sync service for `/api/sync/upload` and `/api/sync/download`.
- Login, home dashboard, child registration, and sync status screens.

## Android testing

The app is wired to the deployed backend at
`https://hospital-app-production-a073.up.railway.app` by default.

```bash
npm install
npm run typecheck
```

Verify the deployed backend from the host:

```bash
curl https://hospital-app-production-a073.up.railway.app/health
```

Start Metro in one terminal:

```bash
npm start
```

Start an Android emulator or connect a device, then install/run the app from a
second terminal:

```bash
npm run android
```

To point the app at a local backend during development, set `API_BASE_URL` in a
local `.env` file, for example `http://10.0.2.2:35299` for an Android emulator.
For a physical Android device, use your computer's LAN URL or forward the
backend port with:

```bash
adb reverse tcp:35299 tcp:35299
```
