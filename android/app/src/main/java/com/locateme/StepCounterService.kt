
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
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class StepCounterService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounter: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private val handler = android.os.Handler(
        android.os.Looper.getMainLooper()
    )

    private var webSocket: WebSocket? = null
    private var connected = false
    private var stopping = false
    private var latestSteps: Int? = null

    companion object {
        private const val TAG = "StepService"
        private const val CHANNEL_ID = "locateme_step_channel"
        private const val NOTIFICATION_ID = 1001
    
        private const val SERVER_URL = "wss://ave-broadcasting-tracked-chargers.trycloudflare.com"
    }

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "SERVICE CREATED")
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())

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
            Log.e(TAG, "STEP SENSOR NOT FOUND")
        } else {
            val registered = sensorManager.registerListener(
                this,
                stepCounter,
                SensorManager.SENSOR_DELAY_GAME
            )
            Log.d(TAG, "SERVICE SENSOR REGISTERED: $registered")
        }

        connectWebSocket()
    }

    private fun connectWebSocket() {
        if (stopping) return

        val request = Request.Builder()
            .url(SERVER_URL)
            .build()

        webSocket = client.newWebSocket(
            request,
            object : WebSocketListener() {

                override fun onOpen(
                    webSocket: WebSocket,
                    response: Response
                ) {
                    connected = true
                    Log.d(TAG, "BACKGROUND WEBSOCKET CONNECTED")
                    latestSteps?.let { sendSteps(it) }
                }

                override fun onFailure(
                    webSocket: WebSocket,
                    t: Throwable,
                    response: Response?
                ) {
                    connected = false
                    Log.e(TAG, "BACKGROUND WEBSOCKET ERROR", t)
                    reconnect()
                }

                override fun onClosed(
                    webSocket: WebSocket,
                    code: Int,
                    reason: String
                ) {
                    connected = false
                    Log.d(TAG, "BACKGROUND WEBSOCKET CLOSED")
                    reconnect()
                }
            }
        )
    }

    private fun reconnect() {
        if (stopping) return

        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({
            if (!stopping) connectWebSocket()
        }, 3000)
    }

    private fun sendSteps(steps: Int) {
        if (!connected) return

        val message = JSONObject().apply {
            put("type", "steps")
            put("userId", "userA")
            put("steps", steps)
            put("timestamp", System.currentTimeMillis())
        }

        webSocket?.send(message.toString())
        Log.d(TAG, "BACKGROUND SENT STEPS: $steps")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
            val rawSteps = event.values[0]

            val todaySteps = TodayStepStore.update(
                applicationContext,
                rawSteps
            )

            latestSteps = todaySteps
            Log.d(TAG, "SERVICE STEP EVENT: $todaySteps")
            sendSteps(todaySteps)
        }
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int
    ) {}

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {
        Log.d(TAG, "SERVICE START COMMAND")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopping = true
        handler.removeCallbacksAndMessages(null)
        connected = false
        webSocket?.close(1000, "Service stopped")
        client.dispatcher.executorService.shutdown()

        sensorManager.unregisterListener(this)

        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }

        Log.d(TAG, "SERVICE DESTROYED")
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "LocateMe Step Tracking",
                NotificationManager.IMPORTANCE_LOW
            )

            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("LocateMe is active")
                .setContentText("Tracking and sharing your steps")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("LocateMe is active")
                .setContentText("Tracking and sharing your steps")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build()
        }
    }
}
