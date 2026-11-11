package com.blackbird.hiveagent.scan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import java.time.Instant

/**
 * Opt-in, read-only Unitech ScanService probe.
 *
 * Never reads intent extras (which can contain badge/barcode data), never
 * starts/stops ScanService and never changes Scan2Key or LiveScan settings.
 * Counts hardware-read broadcasts only; these are NOT LiveScan-accepted scans.
 *
 * Registration is deliberately disabled in the calling service until tested
 * on an EA660 with the existing LiveScan configuration.
 */
class ScanActivityObserver(private val context: Context) {
    private val preferences = context.getSharedPreferences("hive_scan_activity", Context.MODE_PRIVATE)
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != ACTION_SCAN_DATA) return
            // Deliberately do not inspect extras, barcode content or symbology.
            val today = java.time.LocalDate.now().toString()
            val previousDay = preferences.getString(KEY_DAY, null)
            val count = if (previousDay == today) preferences.getInt(KEY_COUNT, 0) else 0
            preferences.edit()
                .putString(KEY_DAY, today)
                .putInt(KEY_COUNT, count + 1)
                .putString(KEY_LAST_READ, Instant.now().toString())
                .apply()
        }
    }

    fun start() {
        if (registered) return
        val filter = IntentFilter(ACTION_SCAN_DATA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            context.registerReceiver(receiver, filter)
        }
        registered = true
    }

    fun stop() {
        if (!registered) return
        context.unregisterReceiver(receiver)
        registered = false
    }

    companion object {
        private const val ACTION_SCAN_DATA = "unitech.scanservice.data"
        private const val KEY_DAY = "day"
        private const val KEY_COUNT = "count"
        private const val KEY_LAST_READ = "last_read"
    }
}
