# Hive Device Owner provisioning

Sprint 08 prepares Hive for Android enterprise Device Owner testing without changing existing enrolled devices.

## Safety

Do not use the current production/development handset LB164 for Device Owner testing. Android Device Owner provisioning is intended for a fresh/unprovisioned test device and may require a factory reset. Use a sacrificial device.

## What Device Owner unlocks

When Hive Agent is Device Owner it can report and safely gate enterprise-only capabilities such as lock task (kiosk) mode and camera policy. Existing Device Admin devices continue to support the narrower policies Android permits, including device lock and the configured maximum screen-lock timeout.

## ADB test-device provisioning

Use this only on a dedicated, freshly reset test device with no accounts configured. Install the Hive Agent APK first, then provision the existing admin receiver as Device Owner:

```text
adb shell dpm set-device-owner com.blackbird.hiveagent/.HiveDeviceAdminReceiver
```

Verify the owner state before enrolling the device into Hive:

```text
adb shell dpm list-owners
```

After enrolment, wait for a heartbeat. The Hive dashboard should report `management_mode=device_owner`, `is_device_owner=true`, and enterprise capabilities appropriate to the Android version.

## Kiosk readiness

Sprint 08 adds capability reporting and command-side guards for Device Owner controls. Kiosk/lock-task activation must only be attempted after the device reports Device Owner status. Never infer Device Owner from Device Admin activation.

## Rollout checklist

1. Use a sacrificial Android test device.
2. Factory reset only that test device when required by Android.
3. Install the current Hive Agent build.
4. Provision Hive Agent as Device Owner.
5. Enrol it into a non-production Hive organisation/device record.
6. Confirm heartbeat capability state in the dashboard/API.
7. Test enterprise policies individually before enabling any wider rollout.

Production rollout, zero-touch/QR provisioning and destructive policies remain out of scope until the Device Owner test path has been validated on supported hardware.
