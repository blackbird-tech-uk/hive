package com.blackbird.hiveagent.worker

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object HeartbeatScheduler {

    private const val LOG_TAG = "HiveHeartbeat"

    private const val IMMEDIATE_WORK_NAME =
        "hive-heartbeat-immediate"

    private const val PERIODIC_WORK_NAME =
        "hive-heartbeat-periodic"

    private const val WORK_TAG =
        "hive-heartbeat"

    fun schedule(context: Context) {
        Log.d(
            LOG_TAG,
            "HeartbeatScheduler.schedule called",
        )

        val workManager =
            WorkManager.getInstance(
                context.applicationContext,
            )

        val networkConstraints =
            Constraints.Builder()
                .setRequiredNetworkType(
                    NetworkType.CONNECTED,
                )
                .build()

        val immediateHeartbeat =
            OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setConstraints(networkConstraints)
                .addTag(WORK_TAG)
                .build()

        workManager.enqueueUniqueWork(
            IMMEDIATE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            immediateHeartbeat,
        )

        Log.d(
            LOG_TAG,
            "Immediate heartbeat enqueued",
        )

        val periodicHeartbeat =
            PeriodicWorkRequestBuilder<HeartbeatWorker>(
                15,
                TimeUnit.MINUTES,
            )
                .setConstraints(networkConstraints)
                .addTag(WORK_TAG)
                .build()

        workManager.enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicHeartbeat,
        )

        Log.d(
            LOG_TAG,
            "Periodic heartbeat enqueued",
        )
    }

    fun cancel(context: Context) {
        val workManager =
            WorkManager.getInstance(
                context.applicationContext,
            )

        workManager.cancelUniqueWork(
            IMMEDIATE_WORK_NAME,
        )

        workManager.cancelUniqueWork(
            PERIODIC_WORK_NAME,
        )

        Log.d(
            LOG_TAG,
            "Heartbeat work cancelled",
        )
    }
}