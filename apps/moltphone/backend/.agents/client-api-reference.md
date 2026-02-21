# MoltPhone API Reference — gibtaxi2026

**Base URL:** `https://api.moltphone.xyz`  
**Auth:** `Authorization: Bearer mp_...` (your API key from registration)

---

## 📞 Make a Call

```
POST /call
Authorization: Bearer mp_xxxxxxxxxxxx
Content-Type: application/json
```

```json
{
  "to_number": "+447123456789",
  "assistant_config": {
    "first_message": "Hello, this is the GibTaxi booking assistant. I'd like to book a taxi for John Smith, pickup at 10 High Street at 3pm for 2 passengers.",
    "system_prompt": "You are a professional taxi booking assistant. Be polite and confirm all details.",
    "voice": "alice"
  }
}
```

**Response (201):**
```json
{
  "call": {
    "id": "abc123",
    "status": "queued",
    "to_number": "+447123456789",
    "direction": "outbound",
    "twilioCallSid": "CA..."
  },
  "remaining_balance": 199
}
```

**Errors:** `400` validation, `401` bad key, `402` no tokens, `503` Twilio not configured

---

## 🔍 Get Call Status

```
GET /calls/{callId}
Authorization: Bearer mp_xxxxxxxxxxxx
```

**Response (200):**
```json
{
  "call": {
    "id": "abc123",
    "status": "queued",
    "toNumber": "+447123456789",
    "twilioCallSid": "CA...",
    "createdAt": "2026-02-21T21:04:47.000Z"
  }
}
```

---

## 📋 List All Calls

```
GET /calls?limit=20
Authorization: Bearer mp_xxxxxxxxxxxx
```

---

## ⏹️ End a Call

```
POST /call/end/{callId}
Authorization: Bearer mp_xxxxxxxxxxxx
```

---

## 💰 Token Balance

```
GET /tokens/balance
Authorization: Bearer mp_xxxxxxxxxxxx
```

---

## 👤 Profile

```
GET /me
Authorization: Bearer mp_xxxxxxxxxxxx
```

---

## ⚠️ Common Mistakes (from your logs)

| ❌ Wrong | ✅ Correct |
|---|---|
| `POST /agents/register` | `POST /register` |
| `GET /agents/me` | `GET /me` |
| `GET /tokens` | `GET /tokens/balance` |
| Body: `{ phoneNumber, task }` | Body: `{ to_number, assistant_config: { first_message, system_prompt } }` |
| Key: `moltphone_cc6d...` | Key: `mp_...` (from `/register` response) |
