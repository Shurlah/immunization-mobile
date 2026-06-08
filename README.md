# Immunization Mobile

React Native offline-first client for health workers.

Implemented foundation:

- Secure token storage through `react-native-encrypted-storage`.
- Local SQLite schema for children, guardians, immunizations, appointments, facilities, vaccines, `SyncQueue`, and `SyncState`.
- Offline child registration writes local data first and creates durable sync queue items.
- Manual/network-triggered sync service for `/api/sync/upload` and `/api/sync/download`.
- Login, home dashboard, child registration, and sync status screens.

## Android testing

The app is wired to the backend running on the host at `http://127.0.0.1:35299`.
For Android emulator traffic, the app uses `http://10.0.2.2:35299`, which is the
emulator alias for the host machine.

```bash
npm install
npm run typecheck
```

Make sure the backend is running, then verify it from the host:

```bash
curl http://127.0.0.1:35299/health
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

For a physical Android device, `10.0.2.2` will not work. Either change
`defaultApiBaseUrl` in `src/services/apiClient.ts` to your computer's LAN URL
or forward the backend port with:

```bash
adb reverse tcp:35299 tcp:35299
```
