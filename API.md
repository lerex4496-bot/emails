# MailTrace REST API Reference

The **MailTrace API** powers the email tracking engine, background workers, web dashboard, and first-party client applications.

- **Base URL (Local)**: `http://localhost:3000`
- **Base URL (Production)**: `https://mailtrace.example.com`
- **Authentication**: Bearer JWT header (`Authorization: Bearer <token>`) or HTTP-only session cookie for dashboard routes. Tracking endpoints (`/t/*`) are unauthenticated.

---

## 1. Tracking Endpoints (Public)

### Pixel Request (Open Signal)
Returns a 68-byte 1x1 transparent PNG with strict anti-caching HTTP headers.

```http
GET /t/open/:token HTTP/1.1
Host: mailtrace.example.com
```

#### Response Headers:
```http
HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: 68
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
X-MailTrace-Classification: QUEUED
```

#### Response Body:
Binary 68-byte transparent PNG.

---

### Link Click (Redirect)
Resolves destination URL exclusively from server-side database. Open redirects via query parameters are strictly forbidden.

```http
GET /t/click/:token HTTP/1.1
Host: mailtrace.example.com
```

#### Response:
```http
HTTP/1.1 302 Found
Location: https://destination-domain.com/path
Cache-Control: no-store, no-cache, must-revalidate
```

---

## 2. First-Party Telemetry (Sender Client Only)

### Confirm First-Party View
Emitted exclusively by verified first-party sender clients (MailTrace Windows, Android app, or Webmail companion) upon rendering an email message in the sender's viewport.

```http
POST /api/v1/events/confirm-view HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "messageId": "msg_01hy49b8qf6g0z",
  "deviceIdentifier": "desktop-win32-c4e9",
  "platform": "WINDOWS"
}
```

#### Response:
```json
{
  "status": "success",
  "eventId": "evt_01hy49c381m9e1",
  "classification": "FIRST_PARTY_VIEW_CONFIRMED",
  "confidence": "CONFIRMED"
}
```

---

## 3. Messages & Sending

### Send Tracked Email
Parses HTML content, extracts and wraps hyperlinks, injects transparent tracking pixel, and dispatches via connected SMTP/OAuth provider.

```http
POST /api/v1/messages/send HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "accountId": "acc_01hy489a71b2",
  "recipients": ["partner@clientcorp.com"],
  "subject": "Q3 Enterprise Implementation Proposal",
  "html": "<p>Hello team,<br/>Here is the proposal: <a href=\"https://docs.example.com/q3\">Review Document</a>.</p>",
  "text": "Hello team, Here is the proposal: https://docs.example.com/q3",
  "trackLinks": true,
  "trackOpens": true
}
```

#### Response (`201 Created`):
```json
{
  "messageId": "msg_01hy49b8qf6g0z",
  "status": "SENT",
  "recipientCount": 1,
  "trackingToken": "tr_9a87d09ef1b32",
  "linksTracked": 1,
  "createdAt": "2026-09-28T10:15:30.000Z"
}
```

---

### List Messages
Retrieve tracked messages with pagination, search query, and recipient status badges.

```http
GET /api/v1/messages?page=1&limit=25&search=proposal HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
```

#### Response (`200 OK`):
```json
{
  "messages": [
    {
      "id": "msg_01hy49b8qf6g0z",
      "subject": "Q3 Enterprise Implementation Proposal",
      "status": "SENT",
      "recipients": [
        {
          "email": "partner@clientcorp.com",
          "openCount": 2,
          "clickCount": 1,
          "hasReplied": false,
          "bestConfidence": "PROBABLE"
        }
      ],
      "metrics": {
        "opens": 2,
        "clicks": 1,
        "firstPartyConfirmed": false
      },
      "sentAt": "2026-09-28T10:15:30.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 25,
    "totalPages": 1
  }
}
```

---

### Get Message Details & Audit Timeline
Provides full evidence-based activity timeline for all recipients of a specific message.

```http
GET /api/v1/messages/:id HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
```

#### Response (`200 OK`):
```json
{
  "id": "msg_01hy49b8qf6g0z",
  "subject": "Q3 Enterprise Implementation Proposal",
  "createdAt": "2026-09-28T10:15:30.000Z",
  "events": [
    {
      "id": "evt_01",
      "type": "TRACKING_RESOURCE_REQUESTED",
      "classification": "SECURITY_SCANNER_PREFETCH",
      "confidence": "LOW",
      "timestamp": "2026-09-28T10:15:32.100Z",
      "timingMs": 2100,
      "anonymizedIp": "198.51.100.0/24",
      "userAgent": "Proofpoint-Email-Scanner/1.2"
    },
    {
      "id": "evt_02",
      "type": "TRACKING_RESOURCE_REQUESTED",
      "classification": "POSSIBLE_EMAIL_OPEN",
      "confidence": "MEDIUM",
      "timestamp": "2026-09-28T10:35:12.000Z",
      "timingMs": 1182000,
      "anonymizedIp": "203.0.113.0/24",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    {
      "id": "evt_03",
      "type": "LINK_CLICKED",
      "classification": "PROBABLE_EMAIL_OPEN",
      "confidence": "HIGH",
      "destinationUrl": "https://docs.example.com/q3",
      "timestamp": "2026-09-28T10:36:04.000Z",
      "timingMs": 1234000
    }
  ]
}
```

---

## 4. Dashboard Metrics

```http
GET /api/v1/dashboard/metrics HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
```

#### Response (`200 OK`):
```json
{
  "totalSent": 284,
  "totalDelivered": 281,
  "resourceRequests": 412,
  "probableOpens": 196,
  "linksClicked": 84,
  "confirmedViews": 112,
  "proxyCacheRate": 0.28,
  "securityScannerRate": 0.09,
  "replyRate": 0.22
}
```

---

## 5. Privacy Settings

### Get Privacy Configuration
```http
GET /api/v1/settings/privacy HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
```

#### Response (`200 OK`):
```json
{
  "anonymizeIps": true,
  "rawIpStorage": false,
  "burstDeduplicationWindowMs": 3000,
  "tokenExpirationDays": 90,
  "enableProxyClassification": true
}
```

### Update Privacy Configuration
```http
PUT /api/v1/settings/privacy HTTP/1.1
Host: mailtrace.example.com
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "anonymizeIps": true,
  "rawIpStorage": false,
  "burstDeduplicationWindowMs": 5000,
  "tokenExpirationDays": 60
}
```
