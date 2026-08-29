package nl.ultra100.sync

import android.content.Context
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Draait elke drie uur en stuurt de wijzigingen naar de server.
 *
 * Drie uur is bewust. Vaker heeft geen zin: Samsung Health synchroniseert zelf ook
 * niet continu, en de app leest geen live data. De accu wint hier van de actualiteit.
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    private val json = Json { encodeDefaults = true; explicitNulls = false }
    private val http = OkHttpClient()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = applicationContext.getSharedPreferences("ultra100", Context.MODE_PRIVATE)
        val apiUrl = prefs.getString("api_url", null) ?: return@withContext Result.failure()
        val token  = prefs.getString("device_token", null) ?: return@withContext Result.failure()

        val hc = HealthConnect(applicationContext)
        if (hc.status() != HealthConnect.Status.BESCHIKBAAR) return@withContext Result.failure()
        if (!hc.heeftToestemming()) return@withContext Result.failure()

        try {
            val vorigToken = prefs.getString("changes_token", null)
            val res = hc.syncSinds(vorigToken)

            if (res.trainingen.isEmpty() && res.dagen.isEmpty() && res.verwijderd.isEmpty()) {
                prefs.edit().putString("changes_token", res.volgendToken)
                    .putLong("laatste_sync", System.currentTimeMillis()).apply()
                return@withContext Result.success()
            }

            val body = json.encodeToString(
                Payload(
                    trainingen = res.trainingen.map(::naarDto),
                    dagen      = res.dagen.map { DagDto(it.datum, it.slaapUren, it.rustpols, it.gewichtKg) },
                    verwijderd = res.verwijderd,
                )
            )

            val req = Request.Builder()
                .url("$apiUrl/api/ingest/health-connect")
                .header("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()

            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    // 4xx is onze fout en lost zich niet op door opnieuw te proberen.
                    return@withContext if (resp.code in 400..499) Result.failure() else Result.retry()
                }
            }

            // Token pas opslaan als de server het heeft ontvangen, anders raak je
            // wijzigingen kwijt die je wel had opgehaald maar nooit hebt verstuurd.
            prefs.edit()
                .putString("changes_token", res.volgendToken)
                .putLong("laatste_sync", System.currentTimeMillis())
                .apply()

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun naarDto(t: Training) = TrainingDto(
        t.externalId, t.bron, t.datum, t.startLokaal, t.sportType, t.titel,
        t.duurSec, t.afstandM, t.stijgingM, t.kcal, t.hartslagGem, t.hartslagMax
    )

    companion object {
        fun plan(context: Context) {
            val werk = PeriodicWorkRequestBuilder<SyncWorker>(3, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "ultra100-sync", ExistingPeriodicWorkPolicy.KEEP, werk
            )
        }

        fun nuDirect(context: Context) {
            val werk = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueue(werk)
        }
    }
}

@Serializable data class TrainingDto(
    val externalId: String, val bron: String, val datum: String, val startLokaal: String,
    val sportType: String, val titel: String?, val duurSec: Long, val afstandM: Double?,
    val stijgingM: Double?, val kcal: Double?, val hartslagGem: Double?, val hartslagMax: Double?
)
@Serializable data class DagDto(
    val datum: String, val slaapUren: Double?, val rustpols: Int?, val gewichtKg: Double?
)
@Serializable data class Payload(
    val trainingen: List<TrainingDto>, val dagen: List<DagDto>, val verwijderd: List<String>
)
