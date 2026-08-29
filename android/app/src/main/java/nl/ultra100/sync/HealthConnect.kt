package nl.ultra100.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.*
import java.time.temporal.ChronoUnit

/**
 * Leest Samsung Health-data via Health Connect.
 *
 * Waarom Health Connect en niet de Samsung Health Data SDK:
 * Samsung Health schrijft zijn data naar Health Connect, dus we krijgen hetzelfde
 * binnen zonder aan Samsung vast te zitten. Vanaf Android 14 zit Health Connect in
 * het besturingssysteem zelf; op Android 9-13 is het een aparte app uit de Play Store.
 *
 * Deze app schrijft NOOIT naar Health Connect. Alleen lezen.
 */
class HealthConnect(private val context: Context) {

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    companion object {
        /** Wat we lezen. Elke toevoeging hier moet ook in AndroidManifest.xml. */
        val PERMISSIONS: Set<String> = setOf(
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ElevationGainedRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(WeightRecord::class),
            // Zonder deze permissie synchroniseert de app alleen als hij open staat.
            // Constante bestaat vanaf connect-client 1.1.0; check de naam bij een SDK-upgrade.
            HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND,
        )

        /** Record-typen waarop we een changes-token aanvragen. */
        private val TRACKED = setOf(
            ExerciseSessionRecord::class,
            SleepSessionRecord::class,
            RestingHeartRateRecord::class,
            WeightRecord::class,
        )
    }

    enum class Status { BESCHIKBAAR, UPDATE_NODIG, NIET_BESCHIKBAAR }

    fun status(): Status = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> Status.BESCHIKBAAR
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> Status.UPDATE_NODIG
        else -> Status.NIET_BESCHIKBAAR
    }

    suspend fun heeftToestemming(): Boolean =
        client.permissionController.getGrantedPermissions().containsAll(PERMISSIONS)

    // ─────────────────────────────────────────────── differentiële sync

    /**
     * Health Connect geeft een token uit waarmee je alleen de wijzigingen sinds die
     * token ophaalt. Een ongebruikt token vervalt na 30 dagen — dan vallen we terug
     * op een volledige uitlezing van de laatste 30 dagen en ontdubbelen we serverside
     * op external_id.
     */
    suspend fun nieuwToken(): String =
        client.getChangesToken(ChangesTokenRequest(recordTypes = TRACKED))

    suspend fun syncSinds(token: String?): SyncResultaat {
        if (token == null) return volledigeUitlezing(dagen = 30)

        val gewijzigd = mutableListOf<Record>()
        val verwijderd = mutableListOf<String>()
        var huidig = token

        try {
            do {
                val response = client.getChanges(huidig)
                if (response.changesTokenExpired) return volledigeUitlezing(dagen = 30)
                response.changes.forEach { change ->
                    when (change) {
                        is UpsertionChange -> gewijzigd += change.record
                        is DeletionChange  -> verwijderd += change.deletedUuid
                    }
                }
                huidig = response.nextChangesToken
            } while (response.hasMore)
        } catch (e: Exception) {
            // Token ongeldig na intrekken en opnieuw geven van permissies.
            return volledigeUitlezing(dagen = 30)
        }

        return SyncResultaat(
            trainingen = gewijzigd.filterIsInstance<ExerciseSessionRecord>().map { naarTraining(it) },
            dagen      = bouwDagen(gewijzigd),
            verwijderd = verwijderd,
            volgendToken = huidig,
        )
    }

    private suspend fun volledigeUitlezing(dagen: Long): SyncResultaat {
        val eind  = Instant.now()
        val start = eind.minus(dagen, ChronoUnit.DAYS)
        val filter = TimeRangeFilter.between(start, eind)

        val sessies = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter)).records
        val slaap   = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records
        val rhr     = client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records
        val gewicht = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter)).records

        return SyncResultaat(
            trainingen = sessies.map { naarTraining(it) },
            dagen      = bouwDagen(slaap + rhr + gewicht),
            verwijderd = emptyList(),
            volgendToken = nieuwToken(),
        )
    }

    // ─────────────────────────────────────────────── vertalen naar ons model

    /**
     * Een trainingssessie in Health Connect bevat zelf geen afstand of hartslag — die
     * staan in losse records over dezelfde periode. We aggregeren ze per sessie.
     */
    private suspend fun naarTraining(s: ExerciseSessionRecord): Training {
        val bereik = TimeRangeFilter.between(s.startTime, s.endTime)
        val agg = try {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(
                        DistanceRecord.DISTANCE_TOTAL,
                        TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                        ElevationGainedRecord.ELEVATION_GAINED_TOTAL,
                        HeartRateRecord.BPM_AVG,
                        HeartRateRecord.BPM_MAX,
                    ),
                    timeRangeFilter = bereik,
                )
            )
        } catch (e: Exception) { null }

        val offset = s.startZoneOffset ?: ZoneId.systemDefault().rules.getOffset(s.startTime)
        val lokaleStart = LocalDateTime.ofInstant(s.startTime, offset)

        return Training(
            externalId  = s.metadata.id,
            bron        = s.metadata.dataOrigin.packageName,   // com.sec.android.app.shealth = Samsung Health
            datum       = lokaleStart.toLocalDate().toString(),
            startLokaal = lokaleStart.toString(),
            sportType   = sportNaam(s.exerciseType),
            titel       = s.title,
            duurSec     = Duration.between(s.startTime, s.endTime).seconds,
            afstandM    = agg?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters,
            stijgingM   = agg?.get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)?.inMeters,
            kcal        = agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories,
            hartslagGem = agg?.get(HeartRateRecord.BPM_AVG)?.toDouble(),
            hartslagMax = agg?.get(HeartRateRecord.BPM_MAX)?.toDouble(),
        )
    }

    /** Slaap, rustpols en gewicht horen bij een kalenderdag, niet bij een activiteit. */
    private fun bouwDagen(records: List<Record>): List<Dagwaarden> {
        val perDag = mutableMapOf<LocalDate, Dagwaarden>()

        fun voor(d: LocalDate) = perDag.getOrPut(d) { Dagwaarden(datum = d.toString()) }

        records.forEach { r ->
            when (r) {
                is SleepSessionRecord -> {
                    val offset = r.endZoneOffset ?: ZoneId.systemDefault().rules.getOffset(r.endTime)
                    // Een nacht schrijven we toe aan de dag waarop je wakker wordt.
                    val dag = LocalDateTime.ofInstant(r.endTime, offset).toLocalDate()
                    val uren = Duration.between(r.startTime, r.endTime).toMinutes() / 60.0
                    val huidig = voor(dag)
                    perDag[dag] = huidig.copy(slaapUren = (huidig.slaapUren ?: 0.0) + uren)
                }
                is RestingHeartRateRecord -> {
                    val offset = r.zoneOffset ?: ZoneId.systemDefault().rules.getOffset(r.time)
                    val dag = LocalDateTime.ofInstant(r.time, offset).toLocalDate()
                    perDag[dag] = voor(dag).copy(rustpols = r.beatsPerMinute.toInt())
                }
                is WeightRecord -> {
                    val offset = r.zoneOffset ?: ZoneId.systemDefault().rules.getOffset(r.time)
                    val dag = LocalDateTime.ofInstant(r.time, offset).toLocalDate()
                    perDag[dag] = voor(dag).copy(gewichtKg = r.weight.inKilograms)
                }
            }
        }
        return perDag.values.toList()
    }

    private fun sportNaam(type: Int): String = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "Run"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING            -> "Hike"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING           -> "Walk"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "Ride"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING     -> "WeightTraining"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL,
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "Swim"
        else -> "Workout"
    }
}

// ─────────────────────────────────────────────── datamodel dat naar de server gaat

data class Training(
    val externalId: String,
    val bron: String,
    val datum: String,
    val startLokaal: String,
    val sportType: String,
    val titel: String?,
    val duurSec: Long,
    val afstandM: Double?,
    val stijgingM: Double?,
    val kcal: Double?,
    val hartslagGem: Double?,
    val hartslagMax: Double?,
)

data class Dagwaarden(
    val datum: String,
    val slaapUren: Double? = null,
    val rustpols: Int? = null,
    val gewichtKg: Double? = null,
)

data class SyncResultaat(
    val trainingen: List<Training>,
    val dagen: List<Dagwaarden>,
    val verwijderd: List<String>,
    val volgendToken: String,
)
