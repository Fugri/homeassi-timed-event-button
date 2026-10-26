"""Constants for the Timed Event integration."""

DOMAIN = "timed_event"
VERSION = "1.1.0"

STORAGE_KEY = f"{DOMAIN}.timers"
STORAGE_VERSION = 1

FRONTEND_URL_BASE = f"/{DOMAIN}_static"
FRONTEND_SCRIPT = "timed-event-button.js"

SERVICE_SCHEDULE = "schedule"
SERVICE_CANCEL = "cancel"

ATTR_ACTION = "action"
ATTR_DATA = "data"
ATTR_DELAY = "delay"
ATTR_AT = "at"
ATTR_REPEAT = "repeat"
ATTR_TIMER_ID = "timer_id"

EVENT_EXECUTED = f"{DOMAIN}_executed"
EVENT_FAILED = f"{DOMAIN}_failed"
