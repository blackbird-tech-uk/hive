package com.blackbird.hiveagent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.core.content.ContextCompat
import java.time.LocalDate
import java.time.ZoneId

/**
 * Opt-in diagnostic probe for Unitech ScanService broadcasts.
 *
 * Never accesses Intent extras: badge/barcode values are neither read nor stored.
 * Never sends ScanService control intents or changes Scan2Key configuration.
 * A hardware decode is NOT confirmation of LiveScan acceptance.
 */
internal class ScanActivityProbe(private val context: Context) {
    private val prefs = context.getSharedPreferences("hive_scan_activity_probe", Context.MODE_PRIVATE)
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_SCAN_DATA) return
            val today = LocalDate.now(ZoneId.systemDefault()).toString()
            val previousDay = prefs.getString("day", null)
            val count = if (previousDay == today) prefs.getInt("count", 0) else 0
            prefs.edit()
                .putString("day", today)
                .putInt("count", (count + 1).coerceAtMost(Int.MAX_VALUE))
                .putLong("last_read_at_ms", System.currentTimeMillis())
                .apply()
            Log.d(TAG, "Unitech hardware read observed (payload not accessed)")
        }
    }

    fun start() {
        if (registered || !prefs.getBoolean("enabled", false)) return
        try {
            ContextCompat.registerReceiver(
                context,
                receiver,
                IntentFilter(ACTION_SCAN_DATA),
                ContextCompat.RECEIVER_EXPORTED,
            )
            registered = true
            Log.i(TAG, "Read-only Unitech scan probe enabled")
        } catch (error: Exception) {
            Log.w(TAG, "Unable to register Unitech scan probe", error)
        }
    }

    fun stop() {
        if (!registered) return
        context.unregisterReceiver(receiver)
        registered = false
    }

    companion object {
        private const val TAG = "HiveScanActivityProbe"
        private const val ACTION_SCAN_DATA = "unitech.scanservice.data"
    }
}
