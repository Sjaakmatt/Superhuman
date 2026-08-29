package nl.ultra100.sync

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * De hele app is één scherm. Hij doet drie dingen: koppelen, toestemming vragen,
 * en laten zien wanneer er voor het laatst is gesynchroniseerd. Verder niets —
 * het echte werk gebeurt in de webapp.
 *
 * Koppelen gaat met een koppelcode die je in de webapp aanmaakt onder Bronnen.
 * Die wisselt de app eenmalig in voor een apparaattoken.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { Scherm() } }
    }

    @Composable
    private fun Scherm() {
        val ctx = this
        val scope = rememberCoroutineScope()
        val prefs = remember { getSharedPreferences("ultra100", Context.MODE_PRIVATE) }
        val hc = remember { HealthConnect(ctx) }

        var status by remember { mutableStateOf(hc.status()) }
        var toestemming by remember { mutableStateOf(false) }
        var gekoppeld by remember { mutableStateOf(prefs.getString("device_token", null) != null) }
        var code by remember { mutableStateOf("") }
        var melding by remember { mutableStateOf<String?>(null) }
        var laatste by remember { mutableStateOf(prefs.getLong("laatste_sync", 0L)) }

        val vraagToestemming = rememberLauncherForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { verleend ->
            toestemming = verleend.containsAll(HealthConnect.PERMISSIONS)
            if (toestemming) SyncWorker.plan(ctx)
        }

        LaunchedEffect(Unit) {
            status = hc.status()
            if (status == HealthConnect.Status.BESCHIKBAAR) toestemming = hc.heeftToestemming()
        }

        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Ultra100", style = MaterialTheme.typography.headlineMedium)
            Text(
                "Deze app leest je trainingen, slaap, rustpols en gewicht uit Health Connect " +
                "en stuurt ze naar je trainingsschema. Hij schrijft zelf niets terug.",
                style = MaterialTheme.typography.bodyMedium
            )

            when (status) {
                HealthConnect.Status.NIET_BESCHIKBAAR -> Card { Column(Modifier.padding(16.dp)) {
                    Text("Health Connect ontbreekt", style = MaterialTheme.typography.titleMedium)
                    Text("Op Android 14 en hoger zit het in het systeem. Daaronder installeer je het uit de Play Store.")
                } }
                HealthConnect.Status.UPDATE_NODIG -> Card { Column(Modifier.padding(16.dp)) {
                    Text("Health Connect heeft een update nodig", style = MaterialTheme.typography.titleMedium)
                    Button(onClick = {
                        startActivity(Intent(Intent.ACTION_VIEW).apply {
                            data = android.net.Uri.parse(
                                "market://details?id=com.google.android.apps.healthdata"
                            )
                        })
                    }) { Text("Bijwerken") }
                } }
                HealthConnect.Status.BESCHIKBAAR -> {

                    // ── stap 1: koppelen
                    if (!gekoppeld) {
                        Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("1 · Koppelen", style = MaterialTheme.typography.titleMedium)
                            Text("Maak in de webapp onder Bronnen een koppelcode aan en vul hem hier in.")
                            OutlinedTextField(
                                value = code, onValueChange = { code = it.uppercase() },
                                label = { Text("Koppelcode") }, singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                enabled = code.length >= 6,
                                onClick = {
                                    scope.launch {
                                        val ok = Koppeling.wisselCodeIn(prefs, code.trim())
                                        gekoppeld = ok
                                        melding = if (ok) "Gekoppeld." else "Code klopt niet of is verlopen."
                                    }
                                }
                            ) { Text("Koppelen") }
                        } }
                    } else {
                        // ── stap 2: toestemming
                        Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("2 · Toestemming", style = MaterialTheme.typography.titleMedium)
                            if (toestemming) {
                                Text("Health Connect geeft toegang. De app synchroniseert elke drie uur, ook op de achtergrond.")
                            } else {
                                Text("Geef toegang tot trainingen, slaap, rustpols en gewicht. " +
                                     "Zeg ook ja tegen lezen op de achtergrond — anders synchroniseert de app " +
                                     "alleen als hij open staat.")
                                Button(onClick = { vraagToestemming.launch(HealthConnect.PERMISSIONS) }) {
                                    Text("Toegang geven")
                                }
                            }
                        } }

                        // ── stap 3: status
                        Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("3 · Synchronisatie", style = MaterialTheme.typography.titleMedium)
                            Text(
                                if (laatste == 0L) "Nog niet gesynchroniseerd."
                                else "Laatste keer: " + SimpleDateFormat("d MMM HH:mm", Locale("nl"))
                                        .format(Date(laatste))
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(enabled = toestemming, onClick = {
                                    SyncWorker.nuDirect(ctx)
                                    melding = "Synchronisatie gestart."
                                }) { Text("Nu synchroniseren") }
                                TextButton(onClick = {
                                    prefs.edit().clear().apply()
                                    gekoppeld = false; melding = "Ontkoppeld."
                                }) { Text("Ontkoppelen") }
                            }
                        } }
                    }
                }
            }

            melding?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
