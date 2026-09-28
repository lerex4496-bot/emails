# MailTrace Technical Architecture

This document details the architectural design, component relationships, data flow, and telemetry invariants of **MailTrace**.

---

## 1. Core Architectural Diagrams

### Diagram 1: Email Sending Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Owner as MailTrace Owner
    participant API as Fastify API (/api/v1/messages/send)
    participant DB as PostgreSQL
    participant Track as Tracking Engine (@mailtrace/tracking)
    participant Prov as Email Provider (SMTP/Gmail/Graph)
    participant MTA as Recipient MTA

    Owner->>API: Submit message (To, Subject, HTML body)
    API->>Track: extractTrackableLinks(html)
    Track-->>API: List of unique HTTP/HTTPS URLs
    API->>API: Generate 128-bit cryptographic tokens (Open & Link tokens)
    API->>DB: In transaction: Create Message, MessageRecipient, TrackedLinks
    API->>Track: injectTracking({ html, openToken, linkTokenMap })
    Track-->>API: Sanitized HTML with rewritten links & invisible 1x1 <img>
    API->>Prov: sendEmail({ from, to, subject, html: customizedHtml, replyTo: replyAlias })
    Prov-->>API: Provider Message-ID / Internet Message-ID
    API->>DB: Update Message status to PROVIDER_ACCEPTED
    Prov->>MTA: Relay MIME email over TLS
```

---

### Diagram 2: Tracking Pixel Request & Header Inspection

```mermaid
sequenceDiagram
    autonumber
    participant Client as Recipient Mail Client / Proxy
    participant API as Tracking Endpoint (/t/open/:token)
    participant Queue as Redis Queue (BullMQ)
    participant Worker as Background Worker
    participant DB as PostgreSQL

    Client->>API: GET /t/open/:token (Headers: UA, Via, Accept, Sec-Purpose)
    API->>API: Apply anti-caching headers (no-store, no-cache, must-revalidate)
    API-->>Client: 200 OK (1x1 Transparent PNG, 68 bytes)
    API->>Queue: Push raw request payload (token, timestamp, headers, user-agent)
    Queue->>Worker: Consume job
    Worker->>DB: Lookup MessageRecipient by openTrackingToken
    Worker->>Worker: Run heuristic classifier (check signatures, timing, burst window)
    Worker->>DB: Insert immutable TrackingEvent (confidence: LOW/MEDIUM/HIGH)
    Worker->>DB: Increment MessageRecipient openResourceCount / probableOpenCount
```

---

### Diagram 3: Click Tracking & Strict Open-Redirect Protection

```mermaid
sequenceDiagram
    autonumber
    actor User as Recipient
    participant Browser as Web Browser
    participant API as Tracking Endpoint (/t/click/:token)
    participant DB as PostgreSQL
    participant Destination as Registered Target URL

    User->>Browser: Clicks link inside email
    Browser->>API: GET /t/click/:token
    API->>DB: Query TrackedLink by token
    alt Token Invalid / Not Registered
        API-->>Browser: 404 Not Found (Invalid or expired link)
    else Token Found
        API->>DB: Increment clickCount and record ClickEvent
        API-->>Browser: 302 Found (Location: registered originalUrl)
        Browser->>Destination: Navigate to verified destination
    end
```

---

### Diagram 4: Reply Association Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Recipient as Email Recipient
    participant Inbound as Inbound Mail Server / Webhook
    participant API as MailTrace Webhook Receiver
    participant Worker as Reply Matching Worker
    participant DB as PostgreSQL

    Recipient->>Inbound: Sends reply email
    Inbound->>API: POST /api/v1/webhooks/inbound-reply (Headers & envelope metadata)
    API->>Worker: Push candidate correlation keys (In-Reply-To, References, To: reply+token@...)
    Worker->>DB: Find original Message by Internet Message-ID, Thread-ID, or Token
    Worker->>DB: Record ReplyEvent (timeToReplySeconds)
    Worker->>DB: Update MessageRecipient replyReceived = true
    Note over Worker: Email body is NEVER parsed, inspected, or saved in DB.
```

---

### Diagram 5: Gmail Integration & Push Sync

```mermaid
sequenceDiagram
    autonumber
    actor Owner as MailTrace User
    participant API as MailTrace API
    participant GoogleAuth as Google Identity Platform
    participant GmailAPI as Gmail REST API
    participant PubSub as Google Cloud Pub/Sub
    participant Worker as BullMQ Worker

    Owner->>API: Initiate Gmail Connect
    API-->>Owner: Redirect to Google OAuth (PKCE, scopes: gmail.send, gmail.readonly)
    Owner->>GoogleAuth: Consent
    GoogleAuth-->>API: Auth Code
    API->>GoogleAuth: Exchange code for tokens
    API->>API: Encrypt refresh token with AES-256-GCM
    API->>GmailAPI: Send tracked email (POST /users/me/messages/send)
    GmailAPI-->>PubSub: Mailbox change notification
    PubSub->>API: Push webhook with History ID
    API->>Worker: Sync mailbox delta to detect replies
```

---

### Diagram 6: Microsoft Graph Integration

```mermaid
sequenceDiagram
    autonumber
    actor Owner as MailTrace User
    participant API as MailTrace API
    participant AzureAD as Microsoft Identity Platform
    participant Graph as Microsoft Graph API (/v1.0/me/sendMail)

    Owner->>API: Initiate Microsoft Connect
    API-->>Owner: Redirect to Azure AD (scopes: Mail.Send, Mail.ReadBasic, offline_access)
    Owner->>AzureAD: Consent
    AzureAD-->>API: Auth Code
    API->>AzureAD: Exchange code for tokens
    API->>API: Encrypt tokens with AES-256-GCM
    API->>Graph: POST /v1.0/me/sendMail (HTML message payload)
    Graph-->>API: 202 Accepted
```

---

### Diagram 7: Android First-Party Confirmation

```mermaid
sequenceDiagram
    autonumber
    actor Owner as MailTrace User
    participant App as Android Jetpack Compose Reader
    participant API as MailTrace API (/api/v1/events/confirm-view)
    participant DB as PostgreSQL

    Owner->>App: Opens message in MessageDetailScreen
    App->>App: Viewport render confirmed by Compose layout
    App->>API: POST /api/v1/events/confirm-view { messageId, platform: 'ANDROID', deviceId }
    API->>DB: Insert TrackingEvent (type: CONFIRMED_EMAIL_VIEW, confidence: CONFIRMED)
    API-->>App: 200 OK (Confirmed)
```

---

### Diagram 8: Windows First-Party Confirmation

```mermaid
sequenceDiagram
    autonumber
    actor Owner as MailTrace User
    participant Tauri as Tauri Desktop Client
    participant Queue as WindowsSyncQueue (Local SQLite / Storage)
    participant API as MailTrace API
    participant DB as PostgreSQL

    Owner->>Tauri: Opens tracked message in reader
    Tauri->>Queue: enqueueConfirmView(messageId, 'win-desktop')
    Queue->>API: POST /api/v1/events/confirm-view
    alt Network Disconnected
        Queue->>Queue: Store in offline queue for background replay
    else Network Connected
        API->>DB: Insert TrackingEvent (type: CONFIRMED_EMAIL_VIEW, confidence: CONFIRMED)
        API-->>Queue: 200 OK
    end
```

---

### Diagram 9: Anti-False-Positive Event Processing Pipeline

```mermaid
flowchart TD
    RAW[Raw HTTP Request Received at /t/open/:token] --> HEADERS[Extract Headers, User-Agent, Timing]
    HEADERS --> CHECK_1{Is First-Party Verified?}
    CHECK_1 -- Yes --> CONFIRMED[CONFIRMED_EMAIL_VIEW\nConfidence: CONFIRMED (1.0)]
    CHECK_1 -- No --> CHECK_2{Prefetch Header Present?}
    CHECK_2 -- Yes --> AUTOMATED_1[TRACKING_RESOURCE_REQUESTED\nClassification: LIKELY_AUTOMATED\nConfidence: LOW]
    CHECK_2 -- No --> CHECK_3{Matches Security Scanner\nProofpoint / Barracuda / Bot?}
    CHECK_3 -- Yes --> AUTOMATED_2[TRACKING_RESOURCE_REQUESTED\nClassification: LIKELY_AUTOMATED\nConfidence: LOW]
    CHECK_3 -- No --> CHECK_4{Matches Caching Proxy\nGoogleImageProxy / Apple MPP?}
    CHECK_4 -- Yes --> PROXY[POSSIBLE_EMAIL_OPEN\nClassification: POSSIBLE_HUMAN\nConfidence: MEDIUM]
    CHECK_4 -- No --> CHECK_5{Time since dispatch < 1.0s?}
    CHECK_5 -- Yes --> AUTOMATED_3[TRACKING_RESOURCE_REQUESTED\nClassification: LIKELY_AUTOMATED\nConfidence: LOW]
    CHECK_5 -- No --> PROBABLE[PROBABLE_EMAIL_OPEN\nClassification: PROBABLE_HUMAN\nConfidence: HIGH]

    CONFIRMED --> DEDUP[Window Burst Deduplication (3s)]
    AUTOMATED_1 --> DEDUP
    AUTOMATED_2 --> DEDUP
    AUTOMATED_3 --> DEDUP
    PROXY --> DEDUP
    PROBABLE --> DEDUP

    DEDUP --> DB[(PostgreSQL Immutable Event Store)]
```

---

## 2. Invariants & Guarantees

1. **Passive Tracking != Confirmed Read:** Passive tracking is always modeled as an empirical evidence stream, never absolute certainty.
2. **Immutable Event History:** Every raw telemetry event is stored with its source and diagnostics. Aggregates are derived dynamically.
3. **Open-Redirect Immune:** Every URL passed through `/t/click/:token` is resolved exclusively via internal database primary records.
4. **Data Minimization:** No raw IP addresses stored by default. No recipient email bodies stored during reply tracking.
