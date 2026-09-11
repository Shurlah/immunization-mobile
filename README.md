# Immunization Mobile

React Native offline-first client for health workers.

Implemented foundation:

- Secure token storage through `react-native-encrypted-storage`.
- Local SQLite schema for children, guardians, immunizations, appointments, facilities, vaccines, `SyncQueue`, and `SyncState`.
- Offline child registration writes local data first and creates durable sync queue items.
- Manual/network-triggered sync service for `/api/sync/upload` and `/api/sync/download`.
- Login, home dashboard, child registration, and sync status screens.

## Setup from scratch (beginner guide)

Start with the [backend guide](https://github.com/Shurlah/hospital-app#readme), then the [admin web guide](https://github.com/Shurlah/immunization-admin-web#readme). Keep the local API running on port 35299. In admin web, create a facility and a `HealthWorker` or `FacilitySupervisor` assigned to it. Use that account on mobile; the seed administrator has no facility and cannot complete facility-dependent sync.

This is a React Native 0.79 native app, not an Expo Go app. Android works on Windows; building iOS requires a Mac. The steps below use **Windows PowerShell**. Run commands one at a time. On macOS/Linux use `npm` instead of `npm.cmd`, `./gradlew` instead of `.\gradlew.bat`, and your own checkout/SDK paths.

### 1. Install the tools

- [Git](https://git-scm.com/downloads), to download the code.
- [Node.js 22](https://nodejs.org/en/download/archive/v22), which includes npm.
- JDK 17, following the [React Native environment guide](https://reactnative.dev/docs/set-up-your-environment).
- [Android Studio](https://developer.android.com/studio). Complete its initial setup, then open **SDK Manager**. Install Android SDK Platform **35**, Build-Tools **35.0.0**, Platform-Tools, Android Emulator, Command-line Tools, and NDK (Side by side) **27.1.12297006**. Enable **Show Package Details** to choose exact versions. These Android versions come from this repository's `android/build.gradle`.

In Windows **Edit environment variables for your account**, set `JAVA_HOME` to your JDK 17 installation directory (not its `bin` folder) and `ANDROID_HOME` to the SDK directory displayed by Android Studio, usually `%LOCALAPPDATA%\Android\Sdk`. Add `%JAVA_HOME%\bin`, `%ANDROID_HOME%\platform-tools`, and `%ANDROID_HOME%\emulator` to your user PATH. Open new terminals afterward.

```powershell
git --version
node --version
npm.cmd --version
java -version
adb version
```

Expect Node 22 and Java 17. You do not need to install Gradle globally: the repository includes its wrapper.

### 2. Download and install dependencies

Use a short checkout path to reduce Windows native-build path-length problems:

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
cd C:\dev
git clone https://github.com/Shurlah/immunization-mobile.git
cd C:\dev\immunization-mobile
npm.cmd ci
npm.cmd run typecheck
```

Sign in with an account that has repository access when prompted. If already cloned, open the existing folder instead. All following commands run from the mobile root unless otherwise stated. Initial dependency and native build downloads can take several minutes.

### 3. Select your local API address

The checked-in default in `src/services/apiClient.ts` points to the deployed Railway API. For local development, change the `defaultApiBaseUrl` string in that file to the address for your device:

| Device | Local API URL |
| --- | --- |
| Android Studio emulator | `http://10.0.2.2:35299` |
| USB-connected Android phone with `adb reverse` below | `http://127.0.0.1:35299` |
| Phone on the same Wi-Fi | `http://YOUR_COMPUTER_LAN_IP:35299` |
| iOS simulator on the Mac running the API | `http://localhost:35299` |

For example, the emulator setting is:

```typescript
const defaultApiBaseUrl = 'http://10.0.2.2:35299';
```

The current Babel/Metro setup has no `.env` loader for custom variables. Although the client references `process.env.API_BASE_URL`, creating `.env` alone does not configure this native bundle. Use the explicit source setting above and keep this local edit out of shared commits. Restart Metro with `npm.cmd start -- --reset-cache` after switching URLs; rebuild any APK to embed the new URL.

For Wi-Fi, run `ipconfig` on your computer and use its private IPv4 address. Keep both devices on the same network, use the backend guide's `0.0.0.0` binding, and allow the API through Windows Firewall on the private network. `localhost` on a phone normally means the phone itself.

### 4. Start an emulator or connect a phone

**Emulator:** in Android Studio, open **Device Manager**, create a virtual phone, download an API 35 system image matching your computer architecture, and start it. Enable hardware virtualization if the emulator reports it is unavailable.

**USB phone:** enable Developer options (tap Build number seven times in Settings), enable USB debugging, connect with a data-capable cable, and accept the phone's debugging prompt.

```powershell
adb devices
```

Your target should appear as `device`, not `unauthorized` or `offline`. Use one connected target for this walkthrough. For a USB phone, forward the API and Metro ports:

```powershell
adb reverse tcp:35299 tcp:35299
adb reverse tcp:8081 tcp:8081
```

Repeat forwarding after reconnecting the phone. For the USB option, use the `127.0.0.1` API URL from the table. Open the corresponding `/health` URL in the device's browser to check API reachability before trying to log in.

### 5. Build and open the app

In terminal 1, from the mobile root:

```powershell
npm.cmd start
```

Metro serves the JavaScript bundle; leave it running. In terminal 2, also from the mobile root:

```powershell
npm.cmd run android
```

Wait for Gradle to build, install, and launch the app. Sign in online using the facility-assigned account created in admin web. Check that the facility and vaccine lists load, register a made-up child, and inspect the Sync screen. For an offline test, disconnect networking after login, register another test child, reconnect, and sync. Confirm the record appears in admin web; do not treat login alone as proof that upload worked.

The current sync service uses a fixed development device ID in `src/services/syncService.ts`. This guide does not establish unique device identity for production use; record any upload error from the Sync screen/API logs when checking this flow.

### 6. Create a standalone Android APK (optional)

After selecting the intended API URL:

```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk` and includes its JavaScript bundle, so Metro is not needed. The current release build uses the debug signing key: it is suitable for local testing, not a store publishing setup. Use an HTTPS API for release testing; plain HTTP allowances in Android's debug manifest do not automatically apply to release builds.

### iOS on a Mac (optional)

Install Xcode with its command-line tools and an iOS simulator, Node, Ruby, and Bundler using the [React Native environment guide](https://reactnative.dev/docs/set-up-your-environment). From this repository root, install dependencies and pods:

```bash
npm ci
bundle install
cd ios
bundle exec pod install
cd ..
npm start
```

In another terminal at the mobile root run `npm run ios`. Select an installed simulator, or open `ios/ImmunizationMobileShell.xcworkspace` in Xcode. A physical iPhone additionally needs Xcode signing/team configuration. If the API runs on a different computer, use that computer's reachable address rather than `localhost`. These iOS steps have not been verified on this Windows machine.

### Everyday restart and troubleshooting

Start the database/API first, then the emulator or phone, Metro, and `npm.cmd run android`. Stop Metro with **Ctrl+C**. Reapply USB forwarding after reconnecting. Do not uninstall or clear app storage while you have unsynced records: that can discard local data.

| Problem | Action |
| --- | --- |
| PowerShell blocks npm.ps1 | Use `npm.cmd`. |
| SDK location not found | Check `ANDROID_HOME`; alternatively create ignored `android/local.properties` with `sdk.dir=C:/Users/YOUR_USER/AppData/Local/Android/Sdk` using your actual SDK path. |
| Java/NDK errors | Check Java 17 and install the exact SDK/NDK versions listed above. |
| Filename/path too long | Use a fresh short checkout such as `C:\imob`, install dependencies there, and build there. |
| No device / unauthorized | Start the emulator or accept USB debugging; check `adb devices`. |
| Cannot connect to Metro | Keep Metro running and repeat USB forwarding for port 8081. |
| Network Error at login | Check the device-specific API URL, `/health`, firewall, and Metro cache. |
| Account has no facility / 403 | Assign the correct role and facility in admin web, then sign out and back in. |
| Sync does not upload | Check Sync errors and API logs, account facility, and the fixed development device ID noted above. |
| APK install signature mismatch | Use an APK signed with the same key; do not uninstall before preserving/syncing local records. |
