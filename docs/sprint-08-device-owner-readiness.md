# Sprint 08 — Device Owner / Enterprise Provisioning Readiness

## Goal

Prepare Hive for Android Device Owner testing without changing the management state of an existing production/test handset.

## Safety boundary

- Do not factory reset LB164.
- Do not attempt `dpm set-device-owner` on an already provisioned device.
- Do not enable destructive device-management actions in this sprint.
- Device Owner activation must be performed only on a sacrificial/test device that can be erased.

## Current baseline

Hive already reports Device Admin and Device Owner state, gates lock-task capability behind Device Owner, supports remote device lock, and exposes managed camera/lock-timeout policy capability.

## Sprint 08 scope

1. Make Device Owner provisioning readiness explicit in device telemetry and the API.
2. Distinguish capability from active policy state so the web UI never offers an enterprise action Android will reject.
3. Add kiosk/lock-task readiness without automatically entering kiosk mode.
4. Document the controlled test-device provisioning path and verification checks.
5. Preserve Device Admin operation for existing devices.

## Provisioning path for a sacrificial test device

Use a device that may be erased. After factory reset, do not add personal/work accounts or complete normal user setup before Device Owner provisioning. Install the matching Hive Agent build, then use Android's supported test provisioning flow for the build/device. The admin receiver is:

`com.blackbird.hiveagent/.HiveDeviceAdminReceiver`

Verify after provisioning:

```text
adb shell dpm list-owners
adb shell dumpsys device_policy
```

Hive should then report `management_mode=device_owner`, `is_device_owner=true`, and Device Owner-only capabilities as available on the next heartbeat.

## Exit criteria

- Existing Device Admin devices continue to heartbeat and lock normally.
- Device Owner-only capabilities remain unavailable on non-Device Owner devices.
- API and web models expose provisioning/readiness state consistently.
- Android build, API tests, and web build pass in CI.
- Physical Device Owner provisioning remains an explicit manual test, not an automated action.
