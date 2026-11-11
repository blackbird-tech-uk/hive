package com.blackbird.hiveagent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Experimental read-only observation of Unitech's decoded-read broadcast.
 *
 * The broadcast can contain a badge value in its extras. Do NOT inspect,
 * log, copy, serialize or transmit those extras. This probe only records
 * the arrival of the action and keeps aggregate metadata on this device.
 *
 * Disabled by default in BuildConfig; does not configure or start ScanService.
 * A broadcast means a hardware decode, NOT a LiveScan-accepted badge.
 */
internal class ScanActivityProbe(private val context: Context) {
    private val prefs = context.getSharedPreferences("hive_scan_activity_probe", Context.MODE_PRIVATE)
    private var registered = false
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_SCAN_DATA) return
            // Never touch intent.extras: it can contain the raw barcode.
            val now = System.currentTimeMillis()
            val day = LocalDate.now(ZoneId.systemDefault()).toString()
            val count = if (prefs.getString("day", null) == day) prefs.getInt("count", 0) else 0
            prefs.edit()
                .putString("day", day)
                .putInt("count", (count + 1).coerceAtMost(Int.MAX_VALUE))
                .putLong("last_read_at", now)
                .apply()
            Log.d(TAG, "Observed hardware read event (metadata only)")
        }
    }

    fun start() {
        if (registered) return
        try {
            ContextCompat.registerReceiver(
                context,
                receiver,
                IntentFilter(ACTION_SCAN_DATA),
                ContextCompat.RECEIVER_EXPORTED,
            )
            registered = true
            Log.i(TAG, "Read-only Unitech scan activity probe enabled")
        } catch (error: RuntimeException) {
            Log.w(TAG, "Unable to register scan activity probe", error)
        }
    }

    fun stop() {
        if (!registered) return
        runCatching { context.unregisterReceiver(receiver) }
        registered = false
    }

    companion object {
        private const val TAG = "HiveScanActivity"
        private const val ACTION_SCAN_DATA = "unitech.scanservice.data"
    }
}
