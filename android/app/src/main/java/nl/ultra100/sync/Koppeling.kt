package nl.ultra100.sync

import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Eenmalige koppeling: een korte code uit de webapp wordt ingewisseld voor een
 * apparaattoken dat blijft staan. De code vervalt na 15 minuten en na eenmalig
 * gebruik — zo staat er nooit een langlevend geheim in een tekstveld.
 */
object Koppeling {

    // Pas dit aan naar je eigen domein voordat je bouwt.
    const val API_URL = "https://ultra100.factumai.nl"

    private val http = OkHttpClient()

    suspend fun wisselCodeIn(prefs: SharedPreferences, code: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject().put("code", code).toString()
                val req = Request.Builder()
                    .url("$API_URL/api/ingest/pair")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()

                http.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext false
                    val json = JSONObject(resp.body?.string() ?: return@withContext false)
                    prefs.edit()
                        .putString("device_token", json.getString("deviceToken"))
                        .putString("api_url", API_URL)
                        .remove("changes_token")   // schone start bij een nieuwe koppeling
                        .apply()
                    true
                }
            } catch (e: Exception) { false }
        }
}
