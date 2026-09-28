package com.mailtrace

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mailtrace.data.api.MailTraceApi
import kotlinx.coroutines.launch

data class TrackedEmail(
    val id: String,
    val subject: String,
    val sender: String,
    val body: String,
    val isConfirmedView: Boolean = false
)

class MainActivity : ComponentActivity() {
    private val api = MailTraceApi()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF2563EB),
                    background = Color(0xFF0F172A),
                    surface = Color(0xFF1E293B)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MailTraceApp(api)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailTraceApp(api: MailTraceApi) {
    var selectedMessage by remember { mutableStateOf<TrackedEmail?>(null) }
    val scope = rememberCoroutineScope()

    var messages by remember {
        mutableStateOf(
            listOf(
                TrackedEmail(
                    id = "01HV-MSG-AND-1",
                    subject = "Q3 Infrastructure Scaling & Invariants",
                    sender = "dev@mycompany.org",
                    body = "Attached is the validated architectural deployment specification."
                ),
                TrackedEmail(
                    id = "01HV-MSG-AND-2",
                    subject = "Security Policy & Cryptographic Verification",
                    sender = "security@infosec.corp",
                    body = "Review completed with zero critical observations."
                )
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            tint = Color(0xFF10B981),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("MailTrace First-Party Reader", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                },
                navigationIcon = {
                    if (selectedMessage != null) {
                        IconButton(onClick = { selectedMessage = null }) {
                            Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            val currentMsg = selectedMessage
            if (currentMsg == null) {
                LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                    items(messages) { msg ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                                .clickable {
                                    selectedMessage = msg
                                    // When viewed in native reader, emit FIRST_PARTY_VIEW_CONFIRMED
                                    scope.launch {
                                        val success = api.confirmView(msg.id, "android-pixel-device")
                                        if (success) {
                                            messages = messages.map {
                                                if (it.id == msg.id) it.copy(isConfirmedView = true) else it
                                            }
                                        }
                                    }
                                },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(msg.subject, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(msg.sender, color = Color.Gray, fontSize = 12.sp)

                                if (msg.isConfirmedView) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = Color(0xFF10B981),
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("First-Party View Confirmed", color = Color(0xFF10B981), fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF064E3B))
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFF34D399))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "First-Party Viewport Render Active: Dispatched CONFIRMED_EMAIL_VIEW",
                                color = Color(0xFFD1FAE5),
                                fontSize = 11.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Text(currentMsg.subject, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("From: ${currentMsg.sender}", color = Color.Gray, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(currentMsg.body, fontSize = 14.sp, lineHeight = 20.sp)
                }
            }
        }
    }
}
