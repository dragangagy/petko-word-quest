# Store packaging — Petko Word Quest

**appId:** `com.glab.petkowordquest`  
**App name:** Petko Word Quest  
**Web assets:** copied into `www/` then synced into native projects (local files, not remote GitHub Pages).

## Prerequisites

| Platform | Required |
|----------|----------|
| Both | Node.js 20+, npm |
| Android | Android Studio or SDK + **JDK 21**, Play Console account |
| iOS | **macOS + Xcode** (cannot archive/upload from Windows), Apple Developer account |

## Daily build / sync

```powershell
npm install
npm run build          # copies static PWA files into www/
npx cap sync           # or: npm run cap:sync
```

Open native IDEs:

```powershell
npm run cap:open:android   # Android Studio
npm run cap:open:ios       # Xcode (macOS only)
```

## Icons & splash

Source icons in repo:

- `app-icon-store.png` — 1024×1024 (Play / App Store master)
- `app-icon-maskable-v2.png` — maskable Android adaptive
- `petko-splash.png` — in-app splash art

Generate Capacitor / native icons from `resources/` (`icon.png` from `app-icon-store.png`, `splash.png` from `petko-splash.png`):

```powershell
npm run assets
npx cap sync
```

Upload the 1024×1024 `app-icon-store.png` in Play Console and App Store Connect as well.

## Android — signed AAB (Google Play)

1. Sync: `npm run cap:sync:android`
2. Open Android Studio: `npm run cap:open:android`
3. Create a release keystore once (keep private; do **not** commit):

```powershell
keytool -genkey -v -keystore petko-word-quest-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias petko
```

4. Copy `android/keystore.properties.example` → `android/keystore.properties` and fill paths/passwords.
5. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**, or:

```powershell
npm run android:bundle
# output: android/app/build/outputs/bundle/release/app-release.aab
```

6. Upload the `.aab` in [Play Console](https://play.google.com/console).

Debug APK (local smoke test; not for Play upload):

```powershell
# Requires JDK 21 and ANDROID_SDK (local.properties is gitignored)
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"   # adjust path
npm run android:debug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

Verified on this machine: `assembleDebug` succeeded with OpenJDK 21 + local Android SDK.

Versioning: set `versionCode` / `versionName` in `android/app/build.gradle`.

## iOS — App Store archive (macOS only)

Windows can generate the `ios/` project via Capacitor, but **Archive and upload require a Mac with Xcode**.

On a Mac:

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Then in Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team + bundle id `com.glab.petkowordquest`
2. Set Marketing / Build versions (CFBundleShortVersionString / CFBundleVersion)
3. Device → **Any iOS Device (arm64)**
4. **Product → Archive**
5. **Distribute App → App Store Connect → Upload**

Or use Transporter / `xcodebuild` after a successful archive.

## Store checklist

- [ ] Package / bundle id: `com.glab.petkowordquest` (same on Play + Apple)
- [ ] App name: Petko Word Quest
- [ ] Privacy policy URL (required if you collect accounts / analytics; Supabase auth counts)
- [ ] 1024×1024 store icon (`app-icon-store.png`)
- [ ] Feature graphic (Play: 1024×500) and screenshots (phone + optional tablet)
- [ ] Splash / launch screen looks correct on device
- [ ] Version code / build number incremented every upload
- [ ] Content rating questionnaire completed
- [ ] Data safety / App Privacy nutrition labels match what the app sends to Supabase
- [ ] Release keystore + Apple certificates backed up offline (never commit secrets)

## What not to commit

- `*.jks` / `*.keystore`
- `android/keystore.properties`
- `android/local.properties`
- Apple `.p12` / provisioning profiles with private keys
- `.env` with secret keys (anon Supabase key in client is expected; service role never)
