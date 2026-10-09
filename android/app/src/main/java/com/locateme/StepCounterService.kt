package com.locateme

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class StepCounterService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounter: Sensor? = null

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        private const val TAG = "StepService"
        private const val CHANNEL_ID = "locateme_step_channel"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "SERVICE CREATED")

        createNotificationChannel()

        startForeground(
            NOTIFICATION_ID,
            createNotification()
        )

        // Keep CPU awake while testing locked-screen step events
        val powerManager =
            getSystemService(Context.POWER_SERVICE) as PowerManager

        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "LocateMe::StepWakeLock"
        )

        wakeLock?.acquire()

        sensorManager =
            getSystemService(Context.SENSOR_SERVICE) as SensorManager

        stepCounter =
            sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        if (stepCounter == null) {
            Log.d(TAG, "STEP SENSOR NOT FOUND")
            return
        }

        Log.d(
            TAG,
            "SERVICE SENSOR FOUND: ${stepCounter?.name}"
        )

        val registered = sensorManager.registerListener(
            this,
            stepCounter,
            SensorManager.SENSOR_DELAY_NORMAL
        )

        Log.d(TAG, "SERVICE SENSOR REGISTERED: $registered")
    }

    override fun onSensorChanged(event: SensorEvent?) {

    if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {

        val rawSteps = event.values[0]

        val todaySteps =
            TodayStepStore.update(
                applicationContext,
                rawSteps
            )

        Log.d(
            TAG,
            "SERVICE STEP EVENT: raw=$rawSteps today=$todaySteps"
        )
    }
}

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int
    ) {
        // Nothing needed here
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        Log.d(TAG, "SERVICE START COMMAND")

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()

        Log.d(TAG, "SERVICE DESTROYED")

        sensorManager.unregisterListener(this)

        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val channel = NotificationChannel(
                CHANNEL_ID,
                "LocateMe Step Tracking",
                NotificationManager.IMPORTANCE_LOW
            )

            val manager =
                getSystemService(NotificationManager::class.java)

            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("LocateMe is active")
                .setContentText("Tracking your steps")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build()

        } else {

            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("LocateMe is active")
                .setContentText("Tracking your steps")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build()
        }
    }
}