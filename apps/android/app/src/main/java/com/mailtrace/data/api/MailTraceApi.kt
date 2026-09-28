package com.mailtrace.data.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MailTraceApi(private val baseUrl: String = "http://10.0.2.2:3000") {
    private val client = OkHttpClient.Builder().build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun confirmView(messageId: String, deviceIdentifier: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("messageId", messageId)
                put("deviceIdentifier", deviceIdentifier)
                put("platform", "ANDROID")
            }

            val request = Request.Builder()
                .url("$baseUrl/api/v1/events/confirm-view")
                .post(payload.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }
}
