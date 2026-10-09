package com.locateme

import android.content.Intent
import androidx.core.content.ContextCompat
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = StepCounterModule.NAME)
class StepCounterModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        const val NAME = "StepCounter"
    }

    private val sensorManager =
        reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val stepCounter: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    private var listenerCount = 0

    override fun getName(): String = "StepCounter"

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "nativeModuleLoaded" to true,
            "hasStepCounter" to (stepCounter != null)
        )
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
        Log.d("StepCounter", "addListener: $eventName")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = (listenerCount - count).coerceAtLeast(0)
        Log.d("StepCounter", "removeListeners: $count")
    }

    @ReactMethod
fun startListening() {
    val serviceIntent =
    Intent(reactContext, StepCounterService::class.java)

ContextCompat.startForegroundService(
    reactContext,
    serviceIntent
)

Log.d("StepCounter", "FOREGROUND SERVICE START REQUESTED")

// existing sensor code

    Log.d("StepCounter", "startListening CALLED")

    if (stepCounter == null) {
        Log.e("StepCounter", "STEP COUNTER SENSOR NOT FOUND")
        return
    }

    Log.d(
        "StepCounter",
        "SENSOR FOUND: name=${stepCounter.name}, type=${stepCounter.type}, stringType=${stepCounter.stringType}"
    )

    val registered = sensorManager.registerListener(
        this,
        stepCounter,
        SensorManager.SENSOR_DELAY_NORMAL
    )

    Log.d("StepCounter", "Sensor registered: $registered")
}



    @ReactMethod
    fun stopListening() {
        Log.d("StepCounter", "stopListening CALLED")
        sensorManager.unregisterListener(this)
    }

   override fun onSensorChanged(event: SensorEvent?) {

    if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {

        val rawSteps = event.values[0]

        val todaySteps =
            TodayStepStore.update(
                reactContext,
                rawSteps
            )

        Log.d(
            "StepCounter",
            "STEP EVENT: raw=$rawSteps today=$todaySteps"
        )

        val params = Arguments.createMap()

        params.putDouble(
            "steps",
            todaySteps.toDouble()
        )

        reactContext
            .getJSModule(
                DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
            )
            .emit("StepCounterUpdate", params)
    }
}
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Nothing needed here
    }
}