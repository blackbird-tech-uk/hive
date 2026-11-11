# HIVE Agent 0.1.2 — LB164 field-test gate

Status: DEVELOPMENT ONLY. Do not merge or deploy the renewal endpoint until reviewed.

## Before installing
- Confirm LB164 is enrolled, its last heartbeat and remote Ping work.
- Record installed application ID, versionCode and signing certificate SHA-256 using `adb shell dumpsys package com.blackbird.hiveagent` and `apksigner verify --print-certs <apk>` (or `adb shell pm path com.blackbird.hiveagent` plus pull APK).
- Confirm new APK is signed with **the same certificate** as the installed application and has a **higher versionCode**. A CI-generated debug APK may use a different debug key and fail to update.
- Check the APK's configured API URL; default Gradle fallback is `http://10.0.2.2:8000/api/v1` (emulator only). Build with a valid environment URL and verify it before installation.
- Verify the backend renewal endpoint is deployed to the selected TEST environment before testing renewal. Production must remain untouched until approved.
- Do not uninstall or clear app storage to solve a signing mismatch: this would lose enrolment.

## Installation
- Capture baseline device ID, HIVE ID, battery, server URL and last heartbeat (do not export the JWT).
- Install using `adb install -r <apk>`; stop on `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- Launch HIVE Agent; confirm it remains enrolled without entering a new enrolment code.

## Acceptance
- Heartbeat arrives and device remains online.
- Remote Ping works.
- Wi-Fi off/on: worker recovers and reports heartbeat after connectivity returns.
- Token within seven days of expiry: renewal succeeds, stores new token, and subsequent heartbeat succeeds.
- Revoked token is refused; no renewal bypass.
- App restart and device reboot preserve enrolment.
- If any step fails, do not expand rollout; capture logs with tokens redacted.

## Limitations
- Proactive renewal requires a still-valid JWT. Devices offline beyond expiry will need a separate recovery mechanism.
- Existing 0.1.0 installations cannot be assumed upgrade-compatible without a signing-certificate check.
- Android CI success proves compilation, not installation, backend availability, or field reliability.
