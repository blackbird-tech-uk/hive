package com.blackbird.hiveagent.commands

import java.util.concurrent.atomic.AtomicBoolean

/** In-process stop signal shared by the ring command and its notification action. */
object RingControl {
    private val stopRequested = AtomicBoolean(false)

    fun begin() {
        stopRequested.set(false)
    }

    fun stop() {
        stopRequested.set(true)
    }

    fun shouldStop(): Boolean = stopRequested.get()
}
