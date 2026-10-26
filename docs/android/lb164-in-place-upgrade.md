# LB164 — safe HIVE Agent in-place upgrade

Status: **NOT INSTALLED**. This is an operator checklist for the original Unitech EA660 scanner LB164 (Android 13). Do not uninstall the installed agent, clear app storage, or re-enrol the scanner as part of this procedure.

## Verified on 26 October 2026

- ADB detected the scanner as `A62321250086 device`.
- Installed package: `com.blackbird.hiveagent`.
- The installed `base.apk` was copied from the scanner and inspected with Android SDK `apksigner verify --print-certs`.
- Installed APK signing SHA-256: `EE:FD:03:C0:73:7B:F0:90:22:13:82:12:70:4C:95:3D:BA:30:C7:A4:0C:D8:A0:0B:9B:AB:6A:F1:04:46:4B:C3`.
- The local Android Studio `%USERPROFILE%\\.android\\debug.keystore` certificate has the **same** SHA-256 fingerprint.
- The GitHub CI debug APK has a **different** certificate (`BB:FA:67:92:80:1A...`) and must **not** be used as an in-place update for LB164.
- Android Studio reported a successful local APK build from `feature/fleet-map-pins-zones`, but the resulting APK's certificate, version and install behaviour **have not yet been verified**.

## Pre-install gates (PC required)

1. Verify the locally built APK exists at `apps/android-agent/app/build/outputs/apk/debug/app-debug.apk`. Record the Git commit SHA and confirm the working tree/branch are what you intend to ship. Do not assume a successful build proves the correct source revision.
2. Run the installed Android SDK's `apksigner.bat verify --print-certs <path-to-app-debug.apk>` and compare the **entire** SHA-256 digest with the installed certificate above. **Stop if different.** Keep the keystore/private key off GitHub and out of chat and build artifacts.
3. Inspect the APK's package name and version code using Android SDK `aapt dump badging <path-to-app-debug.apk>` or `apkanalyzer manifest application-id/version-code`. Require package `com.blackbird.hiveagent` and a version code **greater** than the installed agent. Confirm with `adb shell dumpsys package com.blackbird.hiveagent` or Android Studio's device inspector. Stop if uncertain.
4. Preserve evidence of current enrolment and last heartbeat in the HIVE admin UI before installation; do not expose enrolment tokens or personal data. Ensure the scanner has adequate battery and a stable USB connection.
5. Review the proposed Agent version's backend compatibility and authentication/refresh behaviour. An APK upgrade does **not** itself fix expired JWTs or guarantee continued heartbeats; verify the API side separately.

## Installation (only after all gates pass and operator approves)

Use the exact local APK path verified above:

```bat
"%LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe" install -r "<absolute-path-to-verified-app-debug.apk>"
```

Do **not** use `-d`, `-t`, `pm clear`, or `uninstall`. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, `INSTALL_FAILED_VERSION_DOWNGRADE`, or any other error, **stop**. Do not work around the error by uninstalling.

## Post-install checks

1. Confirm the same package is installed with the intended new version and that app data/enrolment are retained.
2. Launch the agent, confirm the same LB164/HIVE identity, and observe a fresh heartbeat in HIVE (not merely an old online status).
3. Restart the agent and scanner, then re-check heartbeat and enrolment persistence; note the current token lifetime limitation.
4. Record results and any failures in a private test log. If the app fails, do not clear data or blindly downgrade; investigate logs and prepare a separately signed, version-incremented corrective build.

**Release separation:** Android Agent work is on development PR #42 and is not part of web/API release PR #44. No production rollout is implied by this document.
