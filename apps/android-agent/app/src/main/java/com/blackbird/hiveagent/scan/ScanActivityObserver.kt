package com.blackbird.hiveagent.scan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import java.time.LocalDate
import java.time.ZoneId

/**
 * Opt-in, read-only Unitech ScanService observer.
 *
 * Never inspect, log, persist, or upload intent extras: they may contain badge PII.
 * A broadcast means the scanner decoded a barcode, NOT that LiveScan accepted it.
 * No ScanService commands or scanner setting changes are issued.
 */
class ScanActivityObserver(private val context: Context) {
    private var registered = false
    private var day = LocalDate.now()
    private var readsToday = 0
    private var lastReadAtMillis: Long? = null

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_SCAN_DATA) return
            val today = LocalDate.now(ZoneId.systemDefault())
            if (day != today) {
                day = today
                readsToday = 0
            }
            readsToday += 1
            lastReadAtMillis = System.currentTimeMillis()
        }
    }

    fun start() {
        if (registered) return
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(ACTION_SCAN_DATA),
            ContextCompat.RECEIVER_EXPORTED,
        )
        registered = true
    }

    fun stop() {
        if (!registered) return
        context.unregisterReceiver(receiver)
        registered = false
    }

    fun snapshot(): Snapshot {
        val today = LocalDate.now(ZoneId.systemDefault())
        if (day != today) {
            day = today
            readsToday = 0
        }
        return Snapshot(readsToday, lastReadAtMillis)
    }

    data class Snapshot(val hardwareReadsToday: Int, val lastHardwareReadAtMillis: Long?)

    companion object {
        const val ACTION_SCAN_DATA = "unitech.scanservice.data"
    }
}
