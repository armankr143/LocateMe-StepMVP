package com.locateme

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object TodayStepStore {

    private const val PREFS_NAME = "locateme_steps"
    private const val KEY_DATE = "date"
    private const val KEY_LAST_RAW = "last_raw"
    private const val KEY_TODAY_STEPS = "today_steps"

    @Synchronized
    fun update(
        context: Context,
        rawSteps: Float
    ): Int {

        val prefs =
            context.getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            )

        val today =
            SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
            ).format(Date())

        val savedDate =
            prefs.getString(KEY_DATE, null)

        var todaySteps =
            prefs.getInt(KEY_TODAY_STEPS, 0)

        val lastRaw =
            prefs.getFloat(KEY_LAST_RAW, -1f)

        // New day
if (savedDate != today) {

    var newDaySteps = 0

    if (lastRaw >= 0f && rawSteps >= lastRaw) {
        newDaySteps = (rawSteps - lastRaw).toInt()
    }

    prefs.edit()
        .putString(KEY_DATE, today)
        .putFloat(KEY_LAST_RAW, rawSteps)
        .putInt(KEY_TODAY_STEPS, newDaySteps)
        .apply()

    return newDaySteps
}

        // First sensor value
        if (lastRaw < 0f) {

            prefs.edit()
                .putFloat(KEY_LAST_RAW, rawSteps)
                .apply()

            return todaySteps
        }

        // Normal step increase
        if (rawSteps >= lastRaw) {

            val difference =
                (rawSteps - lastRaw).toInt()

            todaySteps += difference
        }

        // If phone rebooted, raw counter may become smaller.
        // Keep today's already-counted steps and start from new raw value.

        prefs.edit()
            .putString(KEY_DATE, today)
            .putFloat(KEY_LAST_RAW, rawSteps)
            .putInt(KEY_TODAY_STEPS, todaySteps)
            .apply()

        return todaySteps
    }
}