/*
 * Timed Event – adds a timer button to the header of every more-info dialog.
 * The button opens a small dialog to run an action on the entity after X minutes/hours.
 * Timers live in the backend (custom_components/timed_event) and survive restarts.
 */
(() => {
  const TAG = "timed-event-button";
  if (customElements.get(TAG)) return;

  // mdi:timer-outline
  const ICON =
    "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z";
  // mdi:close
  const ICON_CLOSE =
    "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";

  const STRINGS = {
    en: {
      title: "Timed action",
      action: "Action",
      value: "Value",
      run_in: "Run in",
      mode_in: "In",
      mode_at: "At",
      run_at: "Date & time",
      repeat: "Repeat",
      repeat_interval: "Repeat every {time}",
      repeat_daily: "Repeat every day at {time}",
      every: "every {time}",
      daily: "daily {time}",
      invalid_at: "Pick a time in the future",
      min_interval: "Repeat interval must be at least 1 minute",
      minutes: "minutes",
      hours: "hours",
      schedule: "Schedule",
      close: "Close",
      pending: "Scheduled",
      none: "Nothing scheduled",
      cancel: "Cancel timer",
      runs_at: "Runs at {time}",
      invalid_delay: "Enter a time greater than 0",
      invalid_value: "Enter a valid value",
      turn_on: "Turn on",
      turn_off: "Turn off",
      toggle: "Toggle",
      brightness: "Turn on with brightness",
      set_value: "Set value",
      select_option: "Select option",
      next: "Next option",
      previous: "Previous option",
      set_temperature: "Set temperature",
      set_hvac_mode: "Set mode",
      open: "Open",
      close_cover: "Close",
      stop: "Stop",
      set_position: "Set position",
      lock: "Lock",
      unlock: "Unlock",
      press: "Press",
      set_percentage: "Set speed",
      volume: "Set volume",
      play: "Play",
      pause: "Pause",
      start: "Start",
      return_home: "Return to dock",
      increment: "Increment",
      decrement: "Decrement",
      reset: "Reset",
      run: "Run",
      activate: "Activate",
      timer_cancel: "Cancel",
    },
    de: {
      title: "Zeitgesteuerte Aktion",
      action: "Aktion",
      value: "Wert",
      run_in: "Ausführen in",
      mode_in: "In",
      mode_at: "Um",
      run_at: "Datum & Uhrzeit",
      repeat: "Wiederholen",
      repeat_interval: "Alle {time} wiederholen",
      repeat_daily: "Täglich um {time} wiederholen",
      every: "alle {time}",
      daily: "täglich {time}",
      invalid_at: "Bitte einen Zeitpunkt in der Zukunft wählen",
      min_interval: "Das Intervall muss mindestens 1 Minute sein",
      minutes: "Minuten",
      hours: "Stunden",
      schedule: "Planen",
      close: "Schließen",
      pending: "Geplant",
      none: "Nichts geplant",
      cancel: "Timer abbrechen",
      runs_at: "Wird um {time} ausgeführt",
      invalid_delay: "Bitte eine Zeit größer 0 eingeben",
      invalid_value: "Bitte einen gültigen Wert eingeben",
      turn_on: "Einschalten",
      turn_off: "Ausschalten",
      toggle: "Umschalten",
      brightness: "Einschalten mit Helligkeit",
      set_value: "Wert setzen",
      select_option: "Option wählen",
      next: "Nächste Option",
      previous: "Vorherige Option",
      set_temperature: "Temperatur setzen",
      set_hvac_mode: "Modus setzen",
      open: "Öffnen",
      close_cover: "Schließen",
      stop: "Stopp",
      set_position: "Position setzen",
      lock: "Verriegeln",
      unlock: "Entriegeln",
      press: "Drücken",
      set_percentage: "Geschwindigkeit setzen",
      volume: "Lautstärke setzen",
      play: "Abspielen",
      pause: "Pause",
      start: "Starten",
      return_home: "Zur Ladestation",
      increment: "Erhöhen",
      decrement: "Verringern",
      reset: "Zurücksetzen",
      run: "Ausführen",
      activate: "Aktivieren",
      timer_cancel: "Abbrechen",
    },
  };

  const lang = (hass) => (hass?.language || "en").split("-")[0];
  const tr = (hass, key, vars = {}) => {
    const s = (STRINGS[lang(hass)] || STRINGS.en)[key] ?? STRINGS.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  };

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------------------------------------------------------------------------
  // Which actions make sense for which entity
  // ---------------------------------------------------------------------------

  const svc = (service, key, field) => ({ service, key, field });
  const onOff = (d) => [svc(`${d}.turn_on`, "turn_on"), svc(`${d}.turn_off`, "turn_off"), svc(`${d}.toggle`, "toggle")];

  function actionsFor(hass, entityId) {
    const st = hass.states[entityId];
    if (!st) return [];
    const a = st.attributes || {};
    const domain = entityId.split(".")[0];
    const tempUnit = hass.config?.unit_system?.temperature || "°";
    const num = (name, min, max, step, value, unit, scale) => ({ name, type: "number", min, max, step, value, unit, scale });

    switch (domain) {
      case "switch":
      case "input_boolean":
      case "siren":
      case "humidifier":
      case "remote":
      case "automation":
        return onOff(domain);
      case "light": {
        const list = onOff(domain);
        const modes = a.supported_color_modes || [];
        if (modes.some((m) => m !== "onoff")) {
          const pct = a.brightness != null ? Math.round(a.brightness / 2.55) : 100;
          list.push(svc("light.turn_on", "brightness", num("brightness_pct", 1, 100, 1, pct, "%")));
        }
        return list;
      }
      case "fan": {
        const list = onOff(domain);
        if (a.percentage !== undefined)
          list.push(svc("fan.set_percentage", "set_percentage", num("percentage", 0, 100, a.percentage_step || 1, a.percentage ?? 0, "%")));
        return list;
      }
      case "media_player": {
        const list = [...onOff(domain), svc("media_player.media_play", "play"), svc("media_player.media_pause", "pause")];
        if (a.volume_level !== undefined)
          list.push(svc("media_player.volume_set", "volume", num("volume_level", 0, 100, 1, Math.round((a.volume_level ?? 0) * 100), "%", 0.01)));
        return list;
      }
      case "climate":
      case "water_heater": {
        const list = [svc(`${domain}.turn_on`, "turn_on"), svc(`${domain}.turn_off`, "turn_off")];
        if (a.temperature !== undefined)
          list.push(svc(`${domain}.set_temperature`, "set_temperature", num("temperature", a.min_temp ?? 5, a.max_temp ?? 35, a.target_temp_step || 0.5, a.temperature ?? 20, tempUnit)));
        if (domain === "climate" && Array.isArray(a.hvac_modes) && a.hvac_modes.length)
          list.push(svc("climate.set_hvac_mode", "set_hvac_mode", { name: "hvac_mode", type: "select", options: a.hvac_modes, value: st.state }));
        return list;
      }
      case "cover": {
        const list = [svc("cover.open_cover", "open"), svc("cover.close_cover", "close_cover"), svc("cover.stop_cover", "stop")];
        if (a.current_position !== undefined)
          list.push(svc("cover.set_cover_position", "set_position", num("position", 0, 100, 1, a.current_position, "%")));
        return list;
      }
      case "valve": {
        const list = [svc("valve.open_valve", "open"), svc("valve.close_valve", "close_cover")];
        if (a.current_position !== undefined)
          list.push(svc("valve.set_valve_position", "set_position", num("position", 0, 100, 1, a.current_position, "%")));
        return list;
      }
      case "lock":
        return [svc("lock.lock", "lock"), svc("lock.unlock", "unlock")];
      case "input_number":
      case "number":
        return [svc(`${domain}.set_value`, "set_value", num("value", a.min ?? 0, a.max ?? 100, a.step ?? 1, parseFloat(st.state), a.unit_of_measurement || ""))];
      case "input_select":
      case "select":
        return [
          svc(`${domain}.select_option`, "select_option", { name: "option", type: "select", options: a.options || [], value: st.state }),
          svc(`${domain}.select_next`, "next"),
          svc(`${domain}.select_previous`, "previous"),
        ];
      case "input_text":
      case "text":
        return [svc(`${domain}.set_value`, "set_value", { name: "value", type: "text", value: st.state, min: a.min, max: a.max })];
      case "input_button":
      case "button":
        return [svc(`${domain}.press`, "press")];
      case "scene":
        return [svc("scene.turn_on", "activate")];
      case "script":
        return [svc("script.turn_on", "run"), svc("script.turn_off", "turn_off")];
      case "vacuum":
        return [svc("vacuum.start", "start"), svc("vacuum.pause", "pause"), svc("vacuum.stop", "stop"), svc("vacuum.return_to_base", "return_home")];
      case "lawn_mower":
        return [svc("lawn_mower.start_mowing", "start"), svc("lawn_mower.pause", "pause"), svc("lawn_mower.dock", "return_home")];
      case "counter":
        return [svc("counter.increment", "increment"), svc("counter.decrement", "decrement"), svc("counter.reset", "reset")];
      case "timer":
        return [svc("timer.start", "start"), svc("timer.pause", "pause"), svc("timer.cancel", "timer_cancel")];
      default:
        // Anything else with an on/off state can still go through the generic helpers.
        return ["on", "off"].includes(st.state) ? onOff("homeassistant") : [];
    }
  }

  // ---------------------------------------------------------------------------
  // One shared backend subscription for all buttons
  // ---------------------------------------------------------------------------

  const store = { timers: [], listeners: new Set(), conn: null, retryAt: 0 };

  function ensureSubscribed(hass) {
    const conn = hass?.connection;
    if (!conn || store.conn === conn || Date.now() < store.retryAt) return;
    store.conn = conn;
    conn
      .subscribeMessage(
        (msg) => {
          store.timers = msg.timers || [];
          store.listeners.forEach((l) => l());
        },
        { type: "timed_event/subscribe" }
      )
      .catch((err) => {
        console.warn("timed_event: subscribe failed", err);
        store.conn = null;
        store.retryAt = Date.now() + 60_000;
      });
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  function formatClock(hass, date, timeOnly = false) {
    const tf = hass.locale?.time_format;
    const opts = { hour: "2-digit", minute: "2-digit", hour12: tf === "12" ? true : tf === "24" ? false : undefined };
    if (!timeOnly && date.toDateString() !== new Date().toDateString()) {
      if (date - Date.now() < 6 * 86400000) opts.weekday = "short";
      else Object.assign(opts, { day: "numeric", month: "short" });
    }
    try {
      return date.toLocaleTimeString(hass.locale?.language || hass.language, opts);
    } catch {
      return date.toLocaleTimeString(undefined, opts);
    }
  }

  // "30 min", "1.5 h", "1 h 20 min"
  function formatInterval(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  // Value for <input type="datetime-local"> in browser time.
  function toLocalInput(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatRemaining(ms) {
    let s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    const hms = h || d ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    return d ? `${d}d ${hms}` : hms;
  }

  // ---------------------------------------------------------------------------
  // The button + dialog element
  // ---------------------------------------------------------------------------

  const CSS = `
    :host { display: inline-flex; position: relative; }
    .wrap { position: relative; display: inline-flex; }
    ha-icon-button.active { color: var(--primary-color); }
    .badge {
      position: absolute; top: 4px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px;
      box-sizing: border-box; border-radius: 8px; font-size: 11px; line-height: 16px; text-align: center;
      background: var(--primary-color); color: var(--text-primary-color, #fff); pointer-events: none;
    }
    .badge[hidden] { display: none; }
    dialog {
      border: none; padding: 0; border-radius: var(--ha-dialog-border-radius, 24px);
      width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
      background: var(--ha-dialog-surface-background, var(--card-background-color, #1c1c1c));
      color: var(--primary-text-color); box-shadow: 0 8px 32px rgba(0,0,0,.5);
      font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
    .head { display: flex; align-items: center; gap: 12px; padding: 16px 12px 8px 24px; }
    .head .titles { flex: 1; min-width: 0; }
    .title { font-size: 20px; font-weight: 500; }
    .sub { font-size: 14px; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .body { padding: 8px 24px 8px; display: flex; flex-direction: column; gap: 14px; }
    label { display: block; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
    select, input {
      width: 100%; box-sizing: border-box; height: 44px; padding: 0 12px; font: inherit; font-size: 16px;
      color: var(--primary-text-color); background: var(--input-fill-color, var(--secondary-background-color, rgba(127,127,127,.12)));
      border: 1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius: 10px; outline: none;
    }
    select:focus, input:focus { border-color: var(--primary-color); }
    select option { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); }
    .row { display: flex; gap: 8px; }
    .row input { flex: 1; }
    .row select { flex: 0 0 auto; width: auto; }
    .with-unit { display: flex; align-items: center; gap: 8px; }
    .with-unit span { color: var(--secondary-text-color); }
    .seg { display: inline-flex; border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 18px; overflow: hidden; margin-bottom: 8px; }
    .seg button {
      font: inherit; font-size: 14px; padding: 6px 18px; border: none; cursor: pointer;
      background: transparent; color: var(--primary-text-color);
    }
    .seg button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    [hidden] { display: none !important; }
    input[type="datetime-local"] { color-scheme: light dark; }
    .check { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; color: var(--primary-text-color); margin: 0; }
    .check input { width: 20px; height: 20px; margin: 0; padding: 0; accent-color: var(--primary-color); flex: 0 0 auto; }
    .rep { font-size: 12px; color: var(--primary-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip {
      font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 16px; cursor: pointer;
      background: transparent; color: var(--primary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.4));
    }
    .chip:hover { border-color: var(--primary-color); color: var(--primary-color); }
    .hint { font-size: 13px; color: var(--secondary-text-color); margin-top: 6px; min-height: 1em; }
    .error { color: var(--error-color, #db4437); font-size: 13px; }
    .error:empty, #valueRow:empty { display: none; }
    h3 { margin: 0 0 6px; font-size: 14px; font-weight: 500; color: var(--secondary-text-color); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li {
      display: flex; align-items: center; gap: 8px; padding: 8px 4px 8px 12px; border-radius: 10px;
      background: var(--secondary-background-color, rgba(127,127,127,.12));
    }
    li .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    li .when { font-size: 13px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .empty { font-size: 14px; color: var(--secondary-text-color); }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px 20px; }
    .btn {
      font: inherit; font-size: 14px; font-weight: 500; padding: 10px 18px; border-radius: 20px; cursor: pointer; border: none;
      background: transparent; color: var(--primary-color);
    }
    .btn.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .btn:disabled { opacity: .5; cursor: default; }
  `;

  class TimedEventButton extends HTMLElement {
    constructor() {
      super();
      this._hass = null;
      this._entityId = null;
      this._actions = [];
      this._tick = null;
      this._onStore = () => {
        this._updateBadge();
        if (this._dlg.open) this._renderPending();
      };

      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style>
        <div class="wrap"><ha-icon-button id="btn"></ha-icon-button><span class="badge" hidden></span></div>
        <dialog id="dlg"></dialog>`;
      this._btn = root.getElementById("btn");
      this._badge = root.querySelector(".badge");
      this._dlg = root.getElementById("dlg");
      this._btn.path = ICON;
      this._btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.open();
      });

      // Keep keys and clicks inside our dialog from reaching the more-info dialog
      // (Escape would close it, letters would trigger HA's global shortcuts).
      for (const type of ["keydown", "keyup", "keypress", "click"]) {
        this._dlg.addEventListener(type, (ev) => ev.stopPropagation());
      }
      this._dlg.addEventListener("click", (ev) => {
        if (ev.target === this._dlg) this.close(); // backdrop click
      });
      this._dlg.addEventListener("close", () => this._stopTick());
    }

    set hass(hass) {
      this._hass = hass;
      ensureSubscribed(hass);
      this._btn.label = tr(hass, "title");
      this._updateBadge();
    }

    get hass() {
      return this._hass;
    }

    set entityId(id) {
      if (id === this._entityId) return;
      this._entityId = id;
      this.close();
      this._updateBadge();
    }

    get entityId() {
      return this._entityId;
    }

    connectedCallback() {
      store.listeners.add(this._onStore);
      this._updateBadge();
    }

    disconnectedCallback() {
      store.listeners.delete(this._onStore);
      this.close();
    }

    _timersForEntity() {
      return store.timers.filter((t) => t.entity_id === this._entityId);
    }

    _updateBadge() {
      const n = this._entityId ? this._timersForEntity().length : 0;
      this._badge.hidden = n === 0;
      this._badge.textContent = String(n);
      this._btn.classList.toggle("active", n > 0);
    }

    close() {
      if (this._dlg.open) this._dlg.close();
      this._stopTick();
    }

    open() {
      const hass = this._hass;
      if (!hass || !this._entityId) return;
      const st = hass.states[this._entityId];
      this._actions = actionsFor(hass, this._entityId);
      const name = st?.attributes?.friendly_name || this._entityId;
      const t = (k, v) => tr(hass, k, v);

      // Preselect the action that changes the current state.
      let defIdx = 0;
      const want = st?.state === "on" ? "turn_off" : st?.state === "off" ? "turn_on" : null;
      if (want) defIdx = Math.max(0, this._actions.findIndex((a) => a.key === want));

      const chips = [
        [5, 60], [15, 60], [30, 60], [1, 3600], [2, 3600], [8, 3600],
      ]
        .map(([v, u]) => `<button class="chip" data-amount="${v}" data-unit="${u}">${v} ${u === 60 ? "min" : "h"}</button>`)
        .join("");

      this._dlg.innerHTML = `
        <div class="head">
          <div class="titles">
            <div class="title">${esc(t("title"))}</div>
            <div class="sub">${esc(name)}</div>
          </div>
          <ha-icon-button id="x"></ha-icon-button>
        </div>
        <div class="body">
          <section><h3>${esc(t("pending"))}</h3><div id="pending"></div></section>
          <div>
            <label for="action">${esc(t("action"))}</label>
            <select id="action">
              ${this._actions.map((a, i) => `<option value="${i}" ${i === defIdx ? "selected" : ""}>${esc(t(a.key))}</option>`).join("")}
            </select>
          </div>
          <div id="valueRow"></div>
          <div>
            <div class="seg" id="mode">
              <button data-mode="in" class="on">${esc(t("mode_in"))}</button>
              <button data-mode="at">${esc(t("mode_at"))}</button>
            </div>
            <div id="inBox">
              <label for="amount">${esc(t("run_in"))}</label>
              <div class="row">
                <input id="amount" type="number" inputmode="decimal" min="0" step="any" value="30">
                <select id="unit">
                  <option value="60" selected>${esc(t("minutes"))}</option>
                  <option value="3600">${esc(t("hours"))}</option>
                </select>
              </div>
              <div class="chips">${chips}</div>
            </div>
            <div id="atBox" hidden>
              <label for="at">${esc(t("run_at"))}</label>
              <input id="at" type="datetime-local" value="${toLocalInput(new Date(Math.ceil(Date.now() / 3600000) * 3600000))}">
            </div>
          </div>
          <div>
            <label class="check"><input type="checkbox" id="repeat"><span id="repeatLabel"></span></label>
            <div class="hint" id="preview"></div>
          </div>
          <div class="error" id="error"></div>
        </div>
        <div class="buttons">
          <button class="btn" id="cancelBtn">${esc(t("close"))}</button>
          <button class="btn primary" id="go">${esc(t("schedule"))}</button>
        </div>`;

      const $ = (sel) => this._dlg.querySelector(sel);
      const x = $("#x");
      x.path = ICON_CLOSE;
      x.label = t("close");
      x.addEventListener("click", () => this.close());
      $("#cancelBtn").addEventListener("click", () => this.close());
      $("#action").addEventListener("change", () => this._renderValueField());
      $("#amount").addEventListener("input", () => this._updatePreview());
      $("#unit").addEventListener("change", () => this._updatePreview());
      $("#at").addEventListener("input", () => this._updatePreview());
      $("#repeat").addEventListener("change", () => this._updatePreview());
      $("#mode").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-mode]");
        if (b) this._setMode(b.dataset.mode);
      });
      $("#amount").addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") this._submit();
      });
      $(".chips").addEventListener("click", (ev) => {
        const chip = ev.target.closest(".chip");
        if (!chip) return;
        $("#amount").value = chip.dataset.amount;
        $("#unit").value = chip.dataset.unit;
        this._updatePreview();
      });
      $("#pending").addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-cancel]");
        if (btn) this._cancelTimer(btn.dataset.cancel);
      });
      $("#go").addEventListener("click", () => this._submit());

      this._renderValueField();
      this._renderPending();
      this._updatePreview();

      if (!this._dlg.open) this._dlg.showModal();
      $("#amount").focus();
      $("#amount").select();
      this._startTick();
    }

    _currentAction() {
      const sel = this._dlg.querySelector("#action");
      return sel ? this._actions[Number(sel.value)] : undefined;
    }

    _renderValueField() {
      const row = this._dlg.querySelector("#valueRow");
      const f = this._currentAction()?.field;
      if (!f) {
        row.innerHTML = "";
        return;
      }
      const label = `<label for="value">${esc(tr(this._hass, "value"))}</label>`;
      if (f.type === "select") {
        row.innerHTML = `${label}<select id="value">${f.options
          .map((o) => `<option value="${esc(o)}" ${o === f.value ? "selected" : ""}>${esc(o)}</option>`)
          .join("")}</select>`;
      } else if (f.type === "number") {
        const v = Number.isFinite(f.value) ? f.value : f.min;
        row.innerHTML = `${label}<div class="with-unit">
          <input id="value" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
          ${f.unit ? `<span>${esc(f.unit)}</span>` : ""}</div>`;
      } else {
        row.innerHTML = `${label}<input id="value" type="text" value="${esc(f.value)}"
          ${f.min != null ? `minlength="${f.min}"` : ""} ${f.max != null ? `maxlength="${f.max}"` : ""}>`;
      }
    }

    _delaySeconds() {
      const amount = parseFloat(String(this._dlg.querySelector("#amount")?.value).replace(",", "."));
      const unit = Number(this._dlg.querySelector("#unit")?.value || 60);
      return Number.isFinite(amount) ? Math.round(amount * unit) : NaN;
    }

    _mode() {
      return this._dlg.querySelector("#mode .on")?.dataset.mode || "in";
    }

    _setMode(mode) {
      this._dlg.querySelectorAll("#mode [data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
      this._dlg.querySelector("#inBox").hidden = mode !== "in";
      this._dlg.querySelector("#atBox").hidden = mode !== "at";
      this._showError("");
      this._updatePreview();
    }

    _atDate() {
      const v = this._dlg.querySelector("#at")?.value;
      const d = v ? new Date(v) : null;
      return d && !isNaN(d) ? d : null;
    }

    // Next run as a Date, or null if the input is invalid.
    _nextRun() {
      if (this._mode() === "in") {
        const s = this._delaySeconds();
        return s > 0 ? new Date(Date.now() + s * 1000) : null;
      }
      const at = this._atDate();
      if (!at) return null;
      if (at > Date.now()) return at;
      if (!this._dlg.querySelector("#repeat")?.checked) return null;
      const next = new Date(at); // daily repeat from a past time: next occurrence
      while (next <= Date.now()) next.setDate(next.getDate() + 1);
      return next;
    }

    _updatePreview() {
      const el = this._dlg.querySelector("#preview");
      if (!el) return;
      const hass = this._hass;
      const label = this._dlg.querySelector("#repeatLabel");
      if (this._mode() === "in") {
        const s = this._delaySeconds();
        label.textContent = s > 0 ? tr(hass, "repeat_interval", { time: formatInterval(s) }) : tr(hass, "repeat");
      } else {
        const at = this._atDate();
        label.textContent = at ? tr(hass, "repeat_daily", { time: formatClock(hass, at, true) }) : tr(hass, "repeat");
      }
      const next = this._nextRun();
      el.textContent = next ? tr(hass, "runs_at", { time: formatClock(hass, next) }) : "";
    }

    _describe(timer) {
      const hass = this._hass;
      const action = this._actions.find(
        (a) => a.service === timer.action && (!a.field || a.field.name in (timer.data || {}))
      );
      if (!action) return timer.action;
      let label = tr(hass, action.key);
      if (action.field) {
        let v = timer.data[action.field.name];
        if (action.field.scale) v = Math.round(v / action.field.scale);
        label += `: ${v}${action.field.unit ? ` ${action.field.unit}` : ""}`;
      }
      return label;
    }

    _renderPending() {
      const box = this._dlg.querySelector("#pending");
      if (!box) return;
      const timers = this._timersForEntity();
      if (!timers.length) {
        box.innerHTML = `<div class="empty">${esc(tr(this._hass, "none"))}</div>`;
        return;
      }
      box.innerHTML = `<ul>${timers
        .map((tm) => {
          const at = new Date(tm.fire_at);
          return `<li>
            <div class="info">
              <span>${esc(this._describe(tm))}</span>
              <span class="when">${esc(formatClock(this._hass, at))} · <span data-rem="${at.getTime()}">${formatRemaining(at - Date.now())}</span></span>
              ${tm.repeat ? `<span class="rep">↻ ${esc(
                tm.repeat === "daily"
                  ? tr(this._hass, "daily", { time: formatClock(this._hass, at, true) })
                  : tr(this._hass, "every", { time: formatInterval(tm.interval) })
              )}</span>` : ""}
            </div>
            <ha-icon-button data-cancel="${esc(tm.id)}"></ha-icon-button>
          </li>`;
        })
        .join("")}</ul>`;
      box.querySelectorAll("ha-icon-button[data-cancel]").forEach((b) => {
        b.path = ICON_CLOSE;
        b.label = tr(this._hass, "cancel");
      });
    }

    _startTick() {
      this._stopTick();
      this._tick = setInterval(() => {
        this._dlg.querySelectorAll("[data-rem]").forEach((el) => {
          el.textContent = formatRemaining(Number(el.dataset.rem) - Date.now());
        });
        this._updatePreview();
      }, 1000);
    }

    _stopTick() {
      if (this._tick) clearInterval(this._tick);
      this._tick = null;
    }

    _showError(msg) {
      const el = this._dlg.querySelector("#error");
      if (el) el.textContent = msg || "";
    }

    async _cancelTimer(id) {
      try {
        await this._hass.callService("timed_event", "cancel", { timer_id: id });
      } catch (err) {
        this._showError(err?.message || String(err));
      }
    }

    async _submit() {
      const hass = this._hass;
      const action = this._currentAction();
      if (!action) return;
      const repeat = this._dlg.querySelector("#repeat").checked;
      const when = {};
      if (this._mode() === "in") {
        const delay = this._delaySeconds();
        if (!(delay > 0)) {
          this._showError(tr(hass, "invalid_delay"));
          return;
        }
        if (repeat && delay < 60) {
          this._showError(tr(hass, "min_interval"));
          return;
        }
        when.delay = delay;
      } else {
        const at = this._atDate();
        if (!at || (!repeat && at <= Date.now())) {
          this._showError(tr(hass, "invalid_at"));
          return;
        }
        when.at = at.toISOString();
      }

      const data = {};
      const f = action.field;
      if (f) {
        const raw = this._dlg.querySelector("#value")?.value ?? "";
        if (f.type === "number") {
          let v = parseFloat(String(raw).replace(",", "."));
          if (!Number.isFinite(v) || v < f.min || v > f.max) {
            this._showError(tr(hass, "invalid_value"));
            return;
          }
          if (f.scale) v = Math.round(v * f.scale * 1000) / 1000;
          data[f.name] = v;
        } else {
          data[f.name] = raw;
        }
      }

      const go = this._dlg.querySelector("#go");
      go.disabled = true;
      this._showError("");
      try {
        await hass.callService("timed_event", "schedule", {
          entity_id: this._entityId,
          action: action.service,
          data,
          ...when,
          repeat,
        });
        this.close();
      } catch (err) {
        this._showError(err?.message || String(err));
      } finally {
        go.disabled = false;
      }
    }
  }

  customElements.define(TAG, TimedEventButton);

  // ---------------------------------------------------------------------------
  // Inject the button into ha-more-info-dialog's header
  // ---------------------------------------------------------------------------

  // Header action icons (history, settings, ⋮) carry slot="actionItems".
  function findAnchor(root, depth = 0) {
    if (!root || depth > 3) return null;
    const hit = root.querySelector('[slot="actionItems"]:not(timed-event-button)');
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot && !el.matches("ha-icon-button, ha-button-menu, ha-md-button-menu")) {
        const found = findAnchor(el.shadowRoot, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function inject(dialog) {
    const root = dialog.shadowRoot;
    if (!root) return;
    const entityId = dialog._entityId;
    const view = dialog._currentView;
    const hass = dialog.hass;
    let btn = dialog.__timedEventButton;

    const show =
      entityId && hass && (!view || view === "info") && !dialog._childView && actionsFor(hass, entityId).length > 0;
    if (!show) {
      if (btn) btn.style.display = "none";
      return;
    }

    if (!btn || !btn.isConnected) {
      const anchor = findAnchor(root);
      if (!anchor) return;
      btn = btn || document.createElement(TAG);
      btn.slot = "actionItems";
      anchor.parentNode.insertBefore(btn, anchor);
      dialog.__timedEventButton = btn;
    }
    btn.style.display = "";
    btn.hass = hass;
    btn.entityId = entityId;
  }

  customElements.whenDefined("ha-more-info-dialog").then(() => {
    const proto = customElements.get("ha-more-info-dialog").prototype;
    const orig = proto.updated;
    proto.updated = function (changed) {
      if (orig) orig.call(this, changed);
      try {
        inject(this);
      } catch (err) {
        console.warn("timed_event: could not add button", err);
      }
    };
    console.info("%c TIMED-EVENT %c button loaded", "background:#03a9f4;color:#fff;border-radius:3px", "");
  });
})();
