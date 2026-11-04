/* ================= ADMIN BROADCAST MESSAGE SYSTEM =================
   Dashboard: send a message with a selected sender.
   Live page: receive messages created after this tab was opened.
   Uses the Firebase Realtime Database instance initialized by script.js.
*/
(function () {
  "use strict";

  const ADMIN_NAMES = [
    "Chandan Malakar",
    "Poonam Ahirwar",
    "Mastram Patel",
    "Bhupendra Parmar"
  ];
  const DB_PATH = "adminMessages";
  const pageOpenedAt = Date.now();

  const $ = (id) => document.getElementById(id);

  function getDatabase() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      return null;
    }
    try { return firebase.database(); } catch (_) { return null; }
  }

  function istDateTime(timestamp) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true
    }).format(new Date(timestamp));
  }

  function addModalStyles() {
    if ($("adminMessageStyles")) return;
    const style = document.createElement("style");
    style.id = "adminMessageStyles";
    style.textContent = `
      .admin-message-icon{width:48px;height:43px;min-width:48px!important;padding:0!important;
        display:inline-flex;align-items:center;justify-content:center;font-size:24px!important;
        color:#48e4e4!important;background:#10171b!important;border:1px solid #27d8dc!important;
        border-radius:13px!important;box-shadow:0 0 12px rgba(0,220,230,.25),inset 0 0 8px rgba(0,220,230,.08)!important}
      .admin-message-icon:hover{box-shadow:0 0 18px rgba(0,220,230,.55)!important;transform:translateY(-1px)}
      .am-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
        padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
      .am-panel{width:min(520px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(145deg,#17191d,#090b0e);
        color:#f5f7fa;border:2px solid #ef233c;border-radius:18px;padding:22px;
        box-shadow:0 0 12px rgba(255,25,55,.65),0 0 36px rgba(255,25,55,.28),inset 0 0 18px rgba(255,25,55,.06)}
      .am-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
      .am-title{font-size:21px;font-weight:900;color:#fff;letter-spacing:.3px}
      .am-label{display:block;color:#bfeeee;font-size:14px;font-weight:800;margin:13px 0 7px}
      .am-input{width:100%;box-sizing:border-box;background:#15191e!important;color:#fff!important;
        border:1px solid #3c555c!important;border-radius:10px!important;padding:12px!important;
        font:600 15px Arial,sans-serif;outline:none}
      .am-input:focus{border-color:#35d9df!important;box-shadow:0 0 0 2px rgba(53,217,223,.15)!important}
      .am-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
      .am-btn{min-width:110px!important;border:0!important;border-radius:10px!important;padding:12px 18px!important;
        color:#fff!important;font-weight:900!important;cursor:pointer}
      .am-send,.am-ok{background:linear-gradient(180deg,#19d68a,#009b5c)!important;box-shadow:0 0 12px rgba(0,220,130,.25)!important}
      .am-cancel{background:#3d454d!important}
      .am-live-panel{width:min(680px,95vw);padding:0;overflow:hidden}
      .am-live-head{padding:17px 22px;border-bottom:1px solid rgba(255,255,255,.13);display:flex;align-items:center;gap:12px}
      .am-live-head .am-title{font-size:24px}
      .am-notice{margin-left:auto;background:#c91e32;color:white;border-radius:20px;padding:6px 13px;font-size:12px;font-weight:900}
      .am-live-body{padding:20px 24px 24px}
      .am-date{color:#d7dce2;font-size:14px;font-weight:700;margin-bottom:12px}
      .am-sender{color:#42e1e5;font-weight:900;margin-bottom:15px;font-size:16px}
      .am-message{white-space:pre-wrap;overflow-wrap:anywhere;background:#11171b;border:1px solid #238b91;
        border-radius:12px;padding:18px;color:#fff;font-size:clamp(18px,2.2vw,24px);line-height:1.55;font-weight:700}
      .am-ok-wrap{display:flex;justify-content:center;margin-top:18px}
      .am-ok{min-width:170px!important;font-size:17px!important}
      @media(max-width:600px){.am-panel{padding:16px}.am-live-panel{padding:0}.am-live-body{padding:16px}.am-live-head .am-title{font-size:19px}}
    `;
    document.head.appendChild(style);
  }

  function makeOverlay(panelClass) {
    const overlay = document.createElement("div");
    overlay.className = "am-overlay";
    const panel = document.createElement("section");
    panel.className = "am-panel " + (panelClass || "");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    overlay.appendChild(panel);
    return { overlay, panel };
  }

  function openAdminComposer() {
    const { overlay, panel } = makeOverlay("");
    const head = document.createElement("div");
    head.className = "am-head";
    const title = document.createElement("div");
    title.className = "am-title";
    title.textContent = "✉ Send Admin Message";
    const close = document.createElement("button");
    close.type = "button"; close.className = "am-btn am-cancel";
    close.textContent = "✕";
    close.style.minWidth = "42px";
    close.addEventListener("click", () => overlay.remove());
    head.append(title, close);

    const senderLabel = document.createElement("label");
    senderLabel.className = "am-label"; senderLabel.textContent = "👤 Sent By (Name)";
    const sender = document.createElement("select");
    sender.className = "am-input"; sender.id = "amSender";
    ADMIN_NAMES.forEach((name) => {
      const option = document.createElement("option");
      option.value = name; option.textContent = name;
      sender.appendChild(option);
    });
    sender.value = "Chandan Malakar";

    const messageLabel = document.createElement("label");
    messageLabel.className = "am-label"; messageLabel.textContent = "💬 Message";
    const message = document.createElement("textarea");
    message.className = "am-input"; message.rows = 5; message.maxLength = 1500;
    message.placeholder = "Yahan apna message likhein...";
    message.id = "amMessage";

    const actions = document.createElement("div");
    actions.className = "am-actions";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "am-btn am-cancel"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => overlay.remove());
    const send = document.createElement("button");
    send.type = "button"; send.className = "am-btn am-send"; send.textContent = "➤ Send Message";
    send.addEventListener("click", () => {
      const text = message.value.trim();
      if (!text) { alert("Please enter a message."); message.focus(); return; }
      const database = getDatabase();
      if (!database) { alert("Firebase connection is not ready. Please try again."); return; }
      send.disabled = true; send.textContent = "Sending...";
      const payload = {
        sender: sender.value,
        message: text,
        createdAt: Date.now()
      };
      database.ref(DB_PATH).push(payload)
        .then(() => overlay.remove())
        .catch((error) => {
          console.error("Admin message send failed:", error);
          alert("Message send nahi hua. Firebase Database Rules / connection check karein.");
          send.disabled = false; send.textContent = "➤ Send Message";
        });
    });
    actions.append(cancel, send);
    panel.append(head, senderLabel, sender, messageLabel, message, actions);
    document.body.appendChild(overlay);
    message.focus();
  }

  function showLiveMessage(data) {
    const { overlay, panel } = makeOverlay("am-live-panel");
    const head = document.createElement("div");
    head.className = "am-live-head";
    const title = document.createElement("div");
    title.className = "am-title"; title.textContent = "📢 ADMIN MESSAGE";
    const badge = document.createElement("span");
    badge.className = "am-notice"; badge.textContent = "Notification";
    head.append(title, badge);

    const body = document.createElement("div");
    body.className = "am-live-body";
    const date = document.createElement("div");
    date.className = "am-date";
    date.textContent = "📅 " + istDateTime(data.createdAt);
    const sender = document.createElement("div");
    sender.className = "am-sender";
    sender.textContent = "👤 Sent By: " + (data.sender || "Admin");
    const message = document.createElement("div");
    message.className = "am-message";
    message.textContent = data.message || "";
    const okWrap = document.createElement("div");
    okWrap.className = "am-ok-wrap";
    const ok = document.createElement("button");
    ok.type = "button"; ok.className = "am-btn am-ok"; ok.textContent = "✓ OK";
    ok.addEventListener("click", () => overlay.remove());
    okWrap.appendChild(ok);
    body.append(date, sender, message, okWrap);
    panel.append(head, body);
    document.body.appendChild(overlay);

    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification("📢 Admin Message", {
          body: (data.sender || "Admin") + ": " + (data.message || ""),
          tag: "admin-message-" + data.createdAt
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      } catch (_) {}
    }
    ok.focus();
  }

  function startLiveListener() {
    const database = getDatabase();
    if (!database) return false;
    const messagesQuery = database.ref(DB_PATH)
      .orderByChild("createdAt")
      .startAt(pageOpenedAt);
    messagesQuery.on("child_added", (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.message) return;
      showLiveMessage(data);
    }, (error) => console.error("Admin message listener error:", error));
    return true;
  }

  function init() {
    addModalStyles();
    const adminButton = $("adminMessageOpen");
    if (adminButton) {
      adminButton.addEventListener("click", openAdminComposer);
    }

    // A message icon is intentionally not added to live.html.
    if ($("table") && !$("adminMessageOpen")) {
      let attempts = 0;
      const wait = setInterval(() => {
        attempts++;
        if (startLiveListener() || attempts >= 80) clearInterval(wait);
      }, 250);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
