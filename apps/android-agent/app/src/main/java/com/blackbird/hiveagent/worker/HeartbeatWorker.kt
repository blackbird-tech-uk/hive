package com.blackbird.hiveagent.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Sprint 1 boundary for future background heartbeat delivery.
 * Network transport and device registration are intentionally deferred.
 */
class HeartbeatWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result = Result.success()
}
