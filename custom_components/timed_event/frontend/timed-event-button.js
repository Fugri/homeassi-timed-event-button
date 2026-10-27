/*
 * Timed Event – adds a timer button to the header of every more-info dialog.
 * The button opens a panel (a more-info "child view", like Settings) to run an
 * action on the entity in X minutes/hours or at a given time, optionally repeating.
 * Timers live in the backend (custom_components/timed_event) and survive restarts.
 */
(() => {
  const TAG = "timed-event-button";
  const PANEL_TAG = "timed-event-panel";
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
      minutes: "minutes",
      hours: "hours",
      mode_in: "In",
      mode_at: "At",
      time: "Time",
      date: "Date",
      today: "Today",
      tomorrow: "Tomorrow",
      pick_date: "Choose date",
      auto_date: "Automatic (today/tomorrow)",
      repeat: "Repeat",
      repeat_interval: "Repeat every {time}",
      repeat_daily: "Repeat every day at {time}",
      every: "every {time}",
      daily: "daily {time}",
      repeat_days: "Repeat on {days} at {time}",
      no_days: "Pick at least one weekday",
      schedule: "Schedule",
      close: "Close",
      pending: "Scheduled",
      none: "Nothing scheduled",
      cancel: "Cancel timer",
      runs_at: "Runs {time}",
      invalid_delay: "Enter a time greater than 0",
      invalid_value: "Enter a valid value",
      invalid_at: "Pick a time in the future",
      min_interval: "Repeat interval must be at least 1 minute",
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
      minutes: "Minuten",
      hours: "Stunden",
      mode_in: "In",
      mode_at: "Um",
      time: "Uhrzeit",
      date: "Datum",
      today: "Heute",
      tomorrow: "Morgen",
      pick_date: "Datum wählen",
      auto_date: "Automatisch (heute/morgen)",
      repeat: "Wiederholen",
      repeat_interval: "Alle {time} wiederholen",
      repeat_daily: "Täglich um {time} wiederholen",
      every: "alle {time}",
      daily: "täglich {time}",
      repeat_days: "Wiederholen am {days} um {time}",
      no_days: "Bitte mindestens einen Wochentag wählen",
      schedule: "Planen",
      close: "Schließen",
      pending: "Geplant",
      none: "Nichts geplant",
      cancel: "Timer abbrechen",
      runs_at: "Wird ausgeführt: {time}",
      invalid_delay: "Bitte eine Zeit größer 0 eingeben",
      invalid_value: "Bitte einen gültigen Wert eingeben",
      invalid_at: "Bitte einen Zeitpunkt in der Zukunft wählen",
      min_interval: "Das Intervall muss mindestens 1 Minute sein",
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

  const pad2 = (n) => String(n).padStart(2, "0");
  const dateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  // Backend weekday keys, Monday first (like Python's weekday()).
  const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const weekdayKey = (d) => WEEKDAYS[(d.getDay() + 6) % 7];

  // Localized short names, Monday first ("Mo", "Di", …).
  function weekdayNames(hass) {
    const loc = hass.locale?.language || hass.language;
    return WEEKDAYS.map((_, i) => {
      const d = new Date(2024, 0, 1 + i); // 2024-01-01 was a Monday
      try {
        return d.toLocaleDateString(loc, { weekday: "short" }).replace(/\.$/, "");
      } catch {
        return WEEKDAYS[i];
      }
    });
  }

  // "Mo, Mi, Fr" for a subset of weekday keys.
  const formatDays = (hass, keys) => {
    const names = weekdayNames(hass);
    return WEEKDAYS.map((k, i) => (keys.includes(k) ? names[i] : null)).filter(Boolean).join(", ");
  };

  // "Today" / "Tomorrow" / "Thu, 30 Oct"
  function dayLabel(hass, d) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return tr(hass, "today");
    if (d.toDateString() === tomorrow.toDateString()) return tr(hass, "tomorrow");
    try {
      return d.toLocaleDateString(hass.locale?.language || hass.language, { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return d.toDateString();
    }
  }

  // ---------------------------------------------------------------------------
  // HA's own pickers (ha-selector → ha-time-input / ha-date-input) are lazy-loaded
  // by the frontend. Loading the tile card editor pulls in ha-form → ha-selector.
  // ---------------------------------------------------------------------------

  let selectorPromise;
  function loadHaSelector() {
    if (customElements.get("ha-selector")) return Promise.resolve(true);
    selectorPromise ??= (async () => {
      const timeout = new Promise((r) => setTimeout(r, 5000));
      try {
        await Promise.race([
          (async () => {
            const helpers = await globalThis.loadCardHelpers();
            helpers.createCardElement({ type: "tile", entity: "sun.sun" });
            await customElements.whenDefined("hui-tile-card");
            await customElements.get("hui-tile-card").getConfigElement();
            await customElements.whenDefined("ha-selector");
          })(),
          timeout,
        ]);
      } catch (err) {
        console.warn("timed_event: could not load HA pickers, using browser inputs", err);
      }
      return !!customElements.get("ha-selector");
    })();
    return selectorPromise;
  }

  // ---------------------------------------------------------------------------
  // The panel (shown as a more-info child view, or inside a fallback <dialog>)
  // ---------------------------------------------------------------------------

  const PANEL_CSS = `
    :host { display: block; padding: 0 var(--ha-space-6, 24px) var(--ha-space-4, 16px); }
    .body { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
    label { display: block; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
    select, input:not([type="checkbox"]) {
      width: 100%; box-sizing: border-box; height: 48px; padding: 0 12px; font: inherit; font-size: 16px;
      color: var(--primary-text-color); background: var(--input-fill-color, var(--secondary-background-color, rgba(127,127,127,.12)));
      border: 1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius: 10px; outline: none; color-scheme: light dark;
    }
    select:focus, input:focus { border-color: var(--primary-color); }
    select option { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); }
    ha-selector { display: block; }
    .row { display: flex; gap: 8px; }
    .row input { flex: 1; }
    .row select { flex: 0 0 auto; width: auto; }
    .with-unit { display: flex; align-items: center; gap: 8px; }
    .with-unit span { color: var(--secondary-text-color); }
    .seg { display: inline-flex; border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 18px; overflow: hidden; margin-bottom: 12px; }
    .seg button { font: inherit; font-size: 14px; padding: 6px 20px; border: none; cursor: pointer; background: transparent; color: var(--primary-text-color); }
    .seg button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    [hidden] { display: none !important; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip {
      font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 16px; cursor: pointer; font-variant-numeric: tabular-nums;
      background: transparent; color: var(--primary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.4));
    }
    .chip:hover { border-color: var(--primary-color); color: var(--primary-color); }
    .days { display: flex; gap: 6px; margin-top: 10px; }
    .days .chip { flex: 1; padding: 6px 0; text-align: center; min-width: 0; }
    .days .chip.on { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
    .dateline { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 14px; }
    .dateline .day { flex: 1; color: var(--secondary-text-color); }
    .link { font: inherit; font-size: 14px; background: none; border: none; color: var(--primary-color); cursor: pointer; padding: 4px 0; }
    #dateHost { margin-top: 8px; }
    .check { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; color: var(--primary-text-color); margin: 0; }
    .check input { width: 20px; height: 20px; margin: 0; accent-color: var(--primary-color); flex: 0 0 auto; }
    .hint { font-size: 13px; color: var(--secondary-text-color); margin-top: 6px; min-height: 1em; }
    .error { color: var(--error-color, #db4437); font-size: 13px; }
    .error:empty, #valueRow:empty { display: none; }
    h3 { margin: 0 0 6px; font-size: 14px; font-weight: 500; color: var(--secondary-text-color); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; align-items: center; gap: 8px; padding: 8px 4px 8px 12px; border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.12)); }
    li .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    li .when { font-size: 13px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .rep { font-size: 12px; color: var(--primary-color); }
    .empty { font-size: 14px; color: var(--secondary-text-color); }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 0 4px; }
    .btn { font: inherit; font-size: 14px; font-weight: 500; padding: 10px 20px; border-radius: 20px; cursor: pointer; border: none; background: transparent; color: var(--primary-color); }
    .btn.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .btn:disabled { opacity: .5; cursor: default; }
  `;

  const QUICK_TIMES = ["06:00", "07:00", "08:00", "12:00", "18:00", "22:00"];

  class TimedEventPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._params = null;
      this._entityId = null;
      this._rendered = false;
      this._actions = [];
      this._mode = "in";
      const next = new Date(Math.ceil(Date.now() / 3600000) * 3600000);
      this._time = `${pad2(next.getHours())}:00`; // "HH:MM", local
      this._date = null; // "YYYY-MM-DD", or null = next occurrence of _time
      this._days = new Set(WEEKDAYS); // weekdays for "At" + repeat
      this._tick = null;
      this._onStore = () => this._renderPending();
      // Keep typing from triggering HA's global keyboard shortcuts.
      for (const type of ["keydown", "keyup", "keypress"]) {
        this.shadowRoot.addEventListener(type, (ev) => {
          if (ev.key !== "Escape") ev.stopPropagation();
        });
      }
    }

    // Set by the more-info dialog (dynamicElement) or by the fallback dialog.
    set hass(hass) {
      this._hass = hass;
      ensureSubscribed(hass);
      this.shadowRoot.querySelectorAll("ha-selector").forEach((s) => (s.hass = hass));
      this._maybeRender();
    }

    get hass() {
      return this._hass;
    }

    set params(params) {
      this._params = params;
      if (params?.entityId !== this._entityId) {
        this._entityId = params?.entityId;
        this._rendered = false;
        this._maybeRender();
      }
    }

    get params() {
      return this._params;
    }

    set entry(_entry) {}

    connectedCallback() {
      store.listeners.add(this._onStore);
      this._maybeRender();
      this._startTick();
    }

    disconnectedCallback() {
      store.listeners.delete(this._onStore);
      this._stopTick();
    }

    async _maybeRender() {
      if (this._rendered || !this._hass || !this._entityId || !this.isConnected) return;
      this._rendered = true;
      this._useHa = await loadHaSelector();
      this._render();
    }

    _t(key, vars) {
      return tr(this._hass, key, vars);
    }

    _$(sel) {
      return this.shadowRoot.querySelector(sel);
    }

    _render() {
      const hass = this._hass;
      const t = (k, v) => this._t(k, v);
      const st = hass.states[this._entityId];
      this._actions = actionsFor(hass, this._entityId);

      // Preselect the action that changes the current state.
      let defIdx = 0;
      const want = st?.state === "on" ? "turn_off" : st?.state === "off" ? "turn_on" : null;
      if (want) defIdx = Math.max(0, this._actions.findIndex((a) => a.key === want));

      const inChips = [[5, 60], [15, 60], [30, 60], [1, 3600], [2, 3600], [8, 3600]]
        .map(([v, u]) => `<button class="chip" data-amount="${v}" data-unit="${u}">${v} ${u === 60 ? "min" : "h"}</button>`)
        .join("");
      const timeChips = QUICK_TIMES.map((v) => {
        const [h, m] = v.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return `<button class="chip" data-time="${v}">${esc(formatClock(hass, d, true))}</button>`;
      }).join("");

      this.shadowRoot.innerHTML = `<style>${PANEL_CSS}</style>
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
              <button data-mode="in">${esc(t("mode_in"))}</button>
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
              <div class="chips" id="inChips">${inChips}</div>
            </div>
            <div id="atBox">
              <div id="timeHost"></div>
              <div class="chips" id="timeChips">${timeChips}</div>
              <div class="dateline">
                <span class="day" id="dayText"></span>
                <button class="link" id="dateToggle"></button>
              </div>
              <div id="dateHost"></div>
            </div>
          </div>
          <div>
            <label class="check"><input type="checkbox" id="repeat"><span id="repeatLabel"></span></label>
            <div class="days" id="days">${weekdayNames(hass)
              .map((n, i) => `<button class="chip${this._days.has(WEEKDAYS[i]) ? " on" : ""}" data-day="${WEEKDAYS[i]}">${esc(n)}</button>`)
              .join("")}</div>
            <div class="hint" id="preview"></div>
          </div>
          <div class="error" id="error"></div>
        </div>
        <div class="buttons">
          ${this._params?.done ? `<button class="btn" id="closeBtn">${esc(t("close"))}</button>` : ""}
          <button class="btn primary" id="go">${esc(t("schedule"))}</button>
        </div>`;

      this._timeField = this._makeField("time", this._time, (v) => {
        this._time = v ? v.slice(0, 5) : null;
        this._updatePreview();
      });
      this._$("#timeHost").append(this._timeField);

      this._$("#closeBtn")?.addEventListener("click", () => this._params.done());
      this._$("#action").addEventListener("change", () => this._renderValueField());
      this._$("#amount").addEventListener("input", () => this._updatePreview());
      this._$("#unit").addEventListener("change", () => this._updatePreview());
      this._$("#repeat").addEventListener("change", () => this._updatePreview());
      this._$("#mode").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-mode]");
        if (b) this._setMode(b.dataset.mode);
      });
      this._$("#inChips").addEventListener("click", (ev) => {
        const chip = ev.target.closest(".chip");
        if (!chip) return;
        this._$("#amount").value = chip.dataset.amount;
        this._$("#unit").value = chip.dataset.unit;
        this._updatePreview();
      });
      this._$("#timeChips").addEventListener("click", (ev) => {
        const chip = ev.target.closest(".chip");
        if (!chip) return;
        this._time = chip.dataset.time;
        this._timeField.value = this._useHa ? `${this._time}:00` : this._time;
        this._updatePreview();
      });
      this._$("#dateToggle").addEventListener("click", () => this._toggleDate());
      this._$("#days").addEventListener("click", (ev) => {
        const chip = ev.target.closest("[data-day]");
        if (!chip) return;
        const day = chip.dataset.day;
        if (this._days.has(day)) this._days.delete(day);
        else this._days.add(day);
        chip.classList.toggle("on", this._days.has(day));
        this._showError("");
        this._updatePreview();
      });
      this._$("#pending").addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-cancel]");
        if (btn) this._cancelTimer(btn.dataset.cancel);
      });
      this._$("#go").addEventListener("click", () => this._submit());
      this._$("#amount").addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") this._submit();
      });

      this._renderValueField();
      this._renderPending();
      this._renderDate();
      this._setMode(this._mode);
    }

    // HA picker if available, browser input otherwise. kind: "time" | "date".
    _makeField(kind, value, onChange) {
      let el;
      if (this._useHa) {
        el = document.createElement("ha-selector");
        el.hass = this._hass;
        el.selector = kind === "time" ? { time: { no_second: true } } : { date: {} };
        el.value = kind === "time" && value ? `${value}:00` : value;
        el.label = this._t(kind);
        el.required = true;
        el.addEventListener("value-changed", (ev) => {
          ev.stopPropagation();
          el.value = ev.detail.value;
          onChange(ev.detail.value);
        });
      } else {
        el = document.createElement("input");
        el.type = kind;
        el.value = value || "";
        el.addEventListener("input", () => onChange(el.value));
      }
      return el;
    }

    _toggleDate() {
      this._date = this._date ? null : dateStr(this._atDate() || new Date());
      this._renderDate();
      this._updatePreview();
    }

    _renderDate() {
      const host = this._$("#dateHost");
      host.replaceChildren();
      this._$("#dateToggle").textContent = this._t(this._date ? "auto_date" : "pick_date");
      if (this._date) {
        host.append(
          this._makeField("date", this._date, (v) => {
            this._date = v || null;
            this._updatePreview();
          })
        );
      }
    }

    _setMode(mode) {
      this._mode = mode;
      this.shadowRoot.querySelectorAll("#mode [data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
      this._$("#inBox").hidden = mode !== "in";
      this._$("#atBox").hidden = mode !== "at";
      this._showError("");
      this._updatePreview();
    }

    _currentAction() {
      const sel = this._$("#action");
      return sel ? this._actions[Number(sel.value)] : undefined;
    }

    _renderValueField() {
      const row = this._$("#valueRow");
      const f = this._currentAction()?.field;
      if (!f) {
        row.innerHTML = "";
        return;
      }
      const label = `<label for="value">${esc(this._t("value"))}</label>`;
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
      const amount = parseFloat(String(this._$("#amount")?.value).replace(",", "."));
      const unit = Number(this._$("#unit")?.value || 60);
      return Number.isFinite(amount) ? Math.round(amount * unit) : NaN;
    }

    // The chosen "At" moment; without a chosen date: the next time the clock shows _time.
    _atDate() {
      if (!this._time) return null;
      const [h, m] = this._time.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      if (this._date) {
        const [y, mo, d] = this._date.split("-").map(Number);
        return new Date(y, mo - 1, d, h, m, 0, 0);
      }
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    }

    // Next run as a Date, or null if the input is invalid.
    _nextRun() {
      if (this._mode === "in") {
        const s = this._delaySeconds();
        return s > 0 ? new Date(Date.now() + s * 1000) : null;
      }
      const at = this._atDate();
      if (!at) return null;
      if (!this._$("#repeat")?.checked) return at > Date.now() ? at : null;
      if (!this._days.size) return null;
      // Daily repeat: first occurrence in the future on an allowed weekday.
      const next = new Date(at);
      while (next <= Date.now() || !this._days.has(weekdayKey(next))) next.setDate(next.getDate() + 1);
      return next;
    }

    _updatePreview() {
      const el = this._$("#preview");
      if (!el) return;
      const hass = this._hass;
      const label = this._$("#repeatLabel");
      if (this._mode === "in") {
        const s = this._delaySeconds();
        label.textContent = s > 0 ? this._t("repeat_interval", { time: formatInterval(s) }) : this._t("repeat");
      } else {
        const at = this._atDate();
        const time = at ? formatClock(hass, at, true) : "";
        const subset = this._days.size > 0 && this._days.size < WEEKDAYS.length;
        label.textContent = !at
          ? this._t("repeat")
          : subset
            ? this._t("repeat_days", { days: formatDays(hass, [...this._days]), time })
            : this._t("repeat_daily", { time });
        this._$("#dayText").textContent = at ? dayLabel(hass, at) : "";
      }
      this._$("#days").hidden = !(this._mode === "at" && this._$("#repeat").checked);
      const next = this._nextRun();
      el.textContent = next ? this._t("runs_at", { time: `${dayLabel(hass, next)}, ${formatClock(hass, next, true)}` }) : "";
    }

    _describe(timer) {
      const action = this._actions.find((a) => a.service === timer.action && (!a.field || a.field.name in (timer.data || {})));
      if (!action) return timer.action;
      let label = this._t(action.key);
      if (action.field) {
        let v = timer.data[action.field.name];
        if (action.field.scale) v = Math.round(v / action.field.scale);
        label += `: ${v}${action.field.unit ? ` ${action.field.unit}` : ""}`;
      }
      return label;
    }

    _renderPending() {
      const box = this._$("#pending");
      if (!box) return;
      const hass = this._hass;
      const timers = store.timers.filter((tm) => tm.entity_id === this._entityId);
      if (!timers.length) {
        box.innerHTML = `<div class="empty">${esc(this._t("none"))}</div>`;
        return;
      }
      box.innerHTML = `<ul>${timers
        .map((tm) => {
          const at = new Date(tm.fire_at);
          const rep = tm.repeat
            ? `<span class="rep">↻ ${esc(
                tm.repeat === "daily"
                  ? tm.weekdays?.length
                    ? `${formatDays(hass, tm.weekdays)} ${formatClock(hass, at, true)}`
                    : this._t("daily", { time: formatClock(hass, at, true) })
                  : this._t("every", { time: formatInterval(tm.interval) })
              )}</span>`
            : "";
          return `<li>
            <div class="info">
              <span>${esc(this._describe(tm))}</span>
              <span class="when">${esc(formatClock(hass, at))} · <span data-rem="${at.getTime()}">${formatRemaining(at - Date.now())}</span></span>
              ${rep}
            </div>
            <ha-icon-button data-cancel="${esc(tm.id)}"></ha-icon-button>
          </li>`;
        })
        .join("")}</ul>`;
      box.querySelectorAll("ha-icon-button[data-cancel]").forEach((b) => {
        b.path = ICON_CLOSE;
        b.label = this._t("cancel");
      });
    }

    _startTick() {
      this._stopTick();
      this._tick = setInterval(() => {
        this.shadowRoot.querySelectorAll("[data-rem]").forEach((el) => {
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
      const el = this._$("#error");
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
      const repeat = this._$("#repeat").checked;
      const when = {};
      if (this._mode === "in") {
        const delay = this._delaySeconds();
        if (!(delay > 0)) return this._showError(this._t("invalid_delay"));
        if (repeat && delay < 60) return this._showError(this._t("min_interval"));
        when.delay = delay;
      } else {
        const at = this._atDate();
        if (!at || (!repeat && at <= Date.now())) return this._showError(this._t("invalid_at"));
        if (repeat && !this._days.size) return this._showError(this._t("no_days"));
        when.at = at.toISOString();
        if (repeat && this._days.size < WEEKDAYS.length) when.weekdays = WEEKDAYS.filter((d) => this._days.has(d));
      }

      const data = {};
      const f = action.field;
      if (f) {
        const raw = this._$("#value")?.value ?? "";
        if (f.type === "number") {
          let v = parseFloat(String(raw).replace(",", "."));
          if (!Number.isFinite(v) || v < f.min || v > f.max) return this._showError(this._t("invalid_value"));
          if (f.scale) v = Math.round(v * f.scale * 1000) / 1000;
          data[f.name] = v;
        } else {
          data[f.name] = raw;
        }
      }

      const go = this._$("#go");
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
        if (this._params?.done) this._params.done();
        else this.dispatchEvent(new CustomEvent("close-child-view", { bubbles: true, composed: true }));
      } catch (err) {
        this._showError(err?.message || String(err));
      } finally {
        go.disabled = false;
      }
    }
  }

  customElements.define(PANEL_TAG, TimedEventPanel);

  // ---------------------------------------------------------------------------
  // The header button
  // ---------------------------------------------------------------------------

  const BUTTON_CSS = `
    :host { display: inline-flex; position: relative; }
    .wrap { position: relative; display: inline-flex; }
    ha-icon-button.active { color: var(--primary-color); }
    .badge {
      position: absolute; top: 4px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px;
      box-sizing: border-box; border-radius: 8px; font-size: 11px; line-height: 16px; text-align: center;
      background: var(--primary-color); color: var(--text-primary-color, #fff); pointer-events: none;
    }
    .badge[hidden] { display: none; }
    /* Fallback for HA versions without more-info child views */
    dialog {
      border: none; padding: 16px 0; border-radius: var(--ha-dialog-border-radius, 24px);
      width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box;
      background: var(--ha-dialog-surface-background, var(--card-background-color, #1c1c1c));
      color: var(--primary-text-color); box-shadow: 0 8px 32px rgba(0,0,0,.5);
      font-family: var(--ha-font-family-body, Roboto, sans-serif);
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
    .title { font-size: 20px; font-weight: 500; padding: 0 24px; }
  `;

  class TimedEventButton extends HTMLElement {
    constructor() {
      super();
      this._hass = null;
      this._entityId = null;
      this.host = null; // the ha-more-info-dialog we live in
      this._onStore = () => this._updateBadge();

      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${BUTTON_CSS}</style>
        <div class="wrap"><ha-icon-button id="btn"></ha-icon-button><span class="badge" hidden></span></div>
        <dialog id="dlg"><div class="title"></div></dialog>`;
      this._btn = root.getElementById("btn");
      this._badge = root.querySelector(".badge");
      this._dlg = root.getElementById("dlg");
      this._btn.path = ICON;
      this._btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.open();
      });
      // Fallback dialog: keep keys/clicks from reaching the more-info dialog.
      for (const type of ["keydown", "keyup", "keypress", "click"]) {
        this._dlg.addEventListener(type, (ev) => ev.stopPropagation());
      }
      this._dlg.addEventListener("click", (ev) => {
        if (ev.target === this._dlg) this._closeFallback();
      });
    }

    set hass(hass) {
      this._hass = hass;
      ensureSubscribed(hass);
      this._btn.label = tr(hass, "title");
      const panel = this._dlg.querySelector(PANEL_TAG);
      if (panel) panel.hass = hass;
      this._updateBadge();
    }

    get hass() {
      return this._hass;
    }

    set entityId(id) {
      if (id === this._entityId) return;
      this._entityId = id;
      this._closeFallback();
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
      this._closeFallback();
    }

    _updateBadge() {
      const n = this._entityId ? store.timers.filter((t) => t.entity_id === this._entityId).length : 0;
      this._badge.hidden = n === 0;
      this._badge.textContent = String(n);
      this._btn.classList.toggle("active", n > 0);
    }

    open() {
      if (!this._hass || !this._entityId) return;
      const title = tr(this._hass, "title");
      if (this.host && "_childView" in this.host) {
        // Native more-info sub page with back arrow (like Settings).
        this.dispatchEvent(
          new CustomEvent("show-child-view", {
            bubbles: true,
            composed: true,
            detail: { viewTag: PANEL_TAG, viewTitle: title, viewParams: { entityId: this._entityId } },
          })
        );
        return;
      }
      const name = this._hass.states[this._entityId]?.attributes?.friendly_name || this._entityId;
      this._dlg.querySelector(".title").textContent = `${title} – ${name}`;
      this._dlg.querySelector(PANEL_TAG)?.remove();
      const panel = document.createElement(PANEL_TAG);
      panel.params = { entityId: this._entityId, done: () => this._closeFallback() };
      panel.hass = this._hass;
      this._dlg.append(panel);
      this._dlg.showModal();
    }

    _closeFallback() {
      if (this._dlg.open) this._dlg.close();
      this._dlg.querySelector(PANEL_TAG)?.remove();
    }
  }

  customElements.define(TAG, TimedEventButton);

  // ---------------------------------------------------------------------------
  // Inject the button into ha-more-info-dialog's header
  // ---------------------------------------------------------------------------

  // Older frontends put header icons in slot="actionItems" of an inner ha-dialog-header.
  function findLegacyAnchor(root, depth = 0) {
    if (!root || depth > 3) return null;
    const hit = root.querySelector(`[slot="actionItems"]:not(${TAG})`);
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot && !el.matches("ha-icon-button, ha-button-menu, ha-md-button-menu")) {
        const found = findLegacyAnchor(el.shadowRoot, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function inject(dialog) {
    const root = dialog.shadowRoot;
    if (!root) return;
    const entityId = dialog._entityId;
    const hass = dialog.hass;
    const view = dialog._currView ?? dialog._currentView;
    let btn = dialog.__timedEventButton;

    const show =
      entityId && hass && (!view || view === "info") && !dialog._childView && actionsFor(hass, entityId).length > 0;
    if (!show) {
      if (btn) btn.style.display = "none";
      return;
    }

    if (!btn || !btn.isConnected) {
      // Current frontend: icons are light-DOM children with slot="headerActionItems".
      let anchor = root.querySelector(`[slot="headerActionItems"]:not(${TAG})`);
      const slot = anchor ? "headerActionItems" : "actionItems";
      anchor ??= findLegacyAnchor(root);
      if (!anchor) return;
      btn = btn || document.createElement(TAG);
      btn.slot = slot;
      anchor.parentNode.insertBefore(btn, anchor);
      dialog.__timedEventButton = btn;
    }
    btn.host = dialog;
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
