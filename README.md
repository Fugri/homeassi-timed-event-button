# Timed Event – timer button for Home Assistant

Adds a ⏱ button to the header of **every entity's more-info dialog** (next to history / settings).
It lets you run an action on that entity **in X minutes or hours** or **at a date and time**, e.g.
"turn the heat pump off in 2 h", "set input_number to 21 at 07:00", "select option *Eco* in 8 h".

* **At:** just set the time (HA's own time picker, or one tap on 06:00 / 07:00 / … chips) – it runs
  today, or tomorrow if that time has already passed. *Choose date* opens HA's date picker for other days.
* **Repeat:** with *In*, the action repeats every X minutes/hours; with *At*, it repeats every day at
  that time (stays at the same local time across DST changes). Repeats skip runs missed while HA was down.

* Timers run in the **backend**, so they still fire when the browser is closed and survive HA restarts
  (overdue timers fire right after startup).
* The button shows a badge with the number of pending timers for that entity; pending timers can be
  cancelled from the dialog.
* Executed with the user who scheduled it (shows in the logbook, respects permissions).
* UI in English and German (follows the HA user language).

## Install

1. Copy `custom_components/timed_event` to `<config>/custom_components/timed_event`
   **or via HACS:** HACS → ⋮ → *Custom repositories* → `https://github.com/Fugri/homeassi-timed-event-button`,
   type *Integration* → download *Timed Event*.
2. Restart Home Assistant.
3. *Settings → Devices & services → Add integration → **Timed Event***.
4. Reload the browser (or clear the app cache on the companion app).

## Supported actions per domain

| Domain | Actions |
|---|---|
| switch, input_boolean, automation, siren, humidifier, remote | on / off / toggle |
| light | on / off / toggle, on with brightness % |
| fan | on / off / toggle, set speed % |
| media_player | on / off / toggle, play, pause, volume % |
| climate, water_heater | on / off, set temperature, (climate) set HVAC mode |
| cover, valve | open, close, (cover) stop, set position |
| lock | lock, unlock |
| input_number, number | set value |
| input_select, select | select option, next, previous |
| input_text, text | set value |
| button, input_button | press |
| scene, script | activate / run, (script) stop |
| vacuum, lawn_mower | start, pause, stop / dock |
| counter, timer | increment / decrement / reset, start / pause / cancel |
| anything else with state on/off | homeassistant.turn_on / turn_off / toggle |

Entities without a sensible action (sensors, binary sensors, …) don't get the button.

## Actions (services) for automations / scripts

```yaml
action: timed_event.schedule
data:
  entity_id: switch.aquarea_main_power
  action: switch.turn_off
  delay: "02:00:00"          # or {hours: 2} or seconds
  # at: "2026-10-27 07:00:00" # instead of delay: run at this time
  # repeat: true              # delay → every 2 h; at → daily at 07:00
  data: {}                   # optional extra data, e.g. {brightness_pct: 40}
response_variable: result    # optional, contains result.timer.id
```

```yaml
action: timed_event.cancel
data:
  entity_id: switch.aquarea_main_power   # or timer_id: <id>
```

Events: `timed_event_executed`, `timed_event_failed` (with `entity_id`, `action`, `data`, `error`).

## How the button gets into the dialog

`frontend/timed-event-button.js` is loaded on every page (`add_extra_js_url`). It hooks the
`updated()` lifecycle of `ha-more-info-dialog` and inserts a `<timed-event-button slot="headerActionItems">`
before the first header action icon. Clicking it opens `<timed-event-panel>` as a more-info *child view*
(the same mechanism the Settings sub-pages use, with a back arrow). Older frontends without child views
get the panel in a separate dialog instead. HA's time/date pickers (`ha-selector`) are lazy-loaded via the
tile card editor; if that fails, browser inputs are used. If a future HA frontend restructures the dialog,
`inject()` at the bottom of the file is the place to adjust.
