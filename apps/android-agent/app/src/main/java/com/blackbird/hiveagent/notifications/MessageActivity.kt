package com.blackbird.hiveagent.notifications

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle

/** Visible local acknowledgement; server-side receipt tracking is a separate feature. */
class MessageActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "HIVE message"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: ""
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Acknowledge") { _, _ -> finish() }
            .setOnDismissListener { finish() }
            .show()
    }

    companion object {
        const val EXTRA_TITLE = "hive_message_title"
        const val EXTRA_MESSAGE = "hive_message_body"
    }
}
