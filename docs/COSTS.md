# ConnectFlo — Cost Catalog (Internal)

This document captures the **unit costs we incur** from third-party providers. It’s intended to be used later to:

- define what usage counters to track (per tenant / per phone number / per call)
- calculate internal COGS
- power customer billing in a predictable way

**Currency:** USD (Twilio pricing pages shown in USD)

**Important:** Twilio pricing can vary by destination, number type, and account discounts. Treat these as **baseline list rates** and confirm in Console before go-live.

---

## 1) Twilio Voice — US (United States)

Source: https://www.twilio.com/voice/pricing/us

### PSTN minutes

| Metric                             |   Unit |          Cost |
| ---------------------------------- | -----: | ------------: |
| Inbound local calls                | minute | $0.0085 / min |
| Inbound toll-free calls            | minute | $0.0220 / min |
| Outbound US/Canada calls (typical) | minute | $0.0140 / min |

### Phone number monthly fees

| Metric                   |         Unit |       Cost |
| ------------------------ | -----------: | ---------: |
| Local number monthly     | number-month | $1.15 / mo |
| Toll-free number monthly | number-month | $2.15 / mo |

### Add-ons (Voice)

| Add-on                        |                  Unit |                 Cost |
| ----------------------------- | --------------------: | -------------------: |
| Call recording (create)       |       recorded-minute |        $0.0025 / min |
| Recording storage             | recorded-minute-month | $0.0005 / min per mo |
| Media Streams                 |                minute |        $0.0040 / min |
| Application Connect (receive) |                minute |        $0.0025 / min |
| Transcription (if enabled)    |                minute |        $0.0500 / min |

---

## 2) Twilio Voice — UK (United Kingdom)

Source: https://www.twilio.com/voice/pricing/gb

### PSTN minutes

| Metric                  |   Unit |          Cost |
| ----------------------- | -----: | ------------: |
| Inbound local calls     | minute | $0.0100 / min |
| Inbound mobile calls    | minute | $0.0100 / min |
| Inbound toll-free calls | minute | $0.0664 / min |
| Outbound local calls    | minute | $0.0158 / min |
| Outbound mobile calls   | minute | $0.0305 / min |

### Phone number monthly fees

| Metric                                        |         Unit |       Cost |
| --------------------------------------------- | -----------: | ---------: |
| Local number monthly (local prefix)           | number-month | $1.15 / mo |
| Toll-free number monthly (local prefix)       | number-month | $2.15 / mo |
| “Clean mobile number” monthly (mobile prefix) | number-month | $1.15 / mo |

### Add-ons (Voice)

Twilio lists the same call recording/storage/transcription unit costs here:

| Add-on                     |                  Unit |                 Cost |
| -------------------------- | --------------------: | -------------------: |
| Call recording (create)    |       recorded-minute |        $0.0025 / min |
| Recording storage          | recorded-minute-month | $0.0005 / min per mo |
| Media Streams              |                minute |        $0.0040 / min |
| Transcription (if enabled) |                minute |        $0.0500 / min |

---

## 3) How to compute costs from usage

### 3.1 Call minutes

For each call, we need to identify:

- locale/country of the Twilio number receiving the call (US vs UK)
- number type (local vs toll-free; UK may also have mobile)
- billable minutes (Twilio rounds per their billing rules)

**Cost formula**

- `call_cost = call_minutes * inbound_rate(locale, number_type)`

### 3.2 Voicemail recordings (what we do today)

In after-hours voicemail mode we use TwiML `<Record>` and Twilio hosts the audio.

We store the `RecordingUrl` in our DB (Message `attachments[]`), but the audio bytes live in Twilio.

Costs:

- **Recording creation:** `recorded_minutes * 0.0025`
- **Storage:** `recorded_minutes_months * 0.0005`

#### Recording storage: minute-month

Storage billing is in **recorded-minute-month**. Two practical approaches:

- **Simple (good enough for 30-day retention):** treat every recording as stored for 1 month

  - `recorded_minutes_months ≈ recorded_minutes` (if always kept ~30 days)

- **Accurate:** compute fraction of a month stored
  - For each recording with duration `m` minutes, stored for `d` days:
    - `minute_months = m * (d / 30)` (approx)
  - Then sum across recordings.

### 3.3 Media Streams (AI calls)

When the call is routed to streaming (`<Stream>`), Twilio charges Media Streams:

- `media_stream_cost = streamed_minutes * 0.0040`

(Plus the inbound PSTN minutes above.)

### 3.4 Agent Web Phone (Voice SDK / WebRTC)

If agents answer calls **in-browser** using Twilio Voice SDK, Twilio may bill **Application Connect** minutes for the client leg (in addition to the inbound PSTN minutes on the Twilio number).

Practical impact:

- inbound call cost still applies (caller → your Twilio number)
- **plus** `application_connect_minutes * application_connect_rate`
- if your routing falls back to PSTN forwarding, outbound PSTN minutes may also apply

---

## 4) Usage counters we should persist (for billing)

These counters map cleanly to the units above.

### Calls

Per tenant, per month:

- `inbound_minutes_us_local`
- `inbound_minutes_us_tollfree`
- `inbound_minutes_uk_local`
- `inbound_minutes_uk_mobile`
- `inbound_minutes_uk_tollfree`

Optional detail:

- break down further per phone number ID

### Streaming

- `media_stream_minutes` (if using Twilio Media Streams)

### Agent Web Phone (Voice SDK)

- `application_connect_minutes` (if agents answer in-browser)

### Voicemail recordings

- `recorded_minutes_total`
- `recorded_minutes_months` (or store each recording’s createdAt + deletedAt and compute later)

### Phone numbers

Per tenant, per month:

- `number_months_us_local`
- `number_months_us_tollfree`
- `number_months_uk_local`
- `number_months_uk_tollfree`
- `number_months_uk_mobile`

---

## 5) Not captured here (to fill in later)

These costs likely exist in production but are not enumerated in this doc yet:

- OpenAI / model usage (Realtime + chat)
- Database hosting (Postgres)
- Object storage (if we ever export recordings out of Twilio)
- Observability (logs/metrics)

Add them once provider + pricing are confirmed.
