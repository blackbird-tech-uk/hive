package com.blackbird.hiveagent.commands

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StopRingReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_STOP_RING) {
            RingControl.stop()
        }
    }

    companion object {
        const val ACTION_STOP_RING = "com.blackbird.hiveagent.STOP_RING"
    }
}
