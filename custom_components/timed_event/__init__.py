"""Timed Event: run an action on any entity after a delay, from its more-info dialog."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_ACTION,
    ATTR_DATA,
    ATTR_DELAY,
    ATTR_TIMER_ID,
    DOMAIN,
    FRONTEND_SCRIPT,
    FRONTEND_URL_BASE,
    SERVICE_CANCEL,
    SERVICE_SCHEDULE,
)
from .manager import TimedEventManager

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

FRONTEND_DIR = Path(__file__).parent / "frontend"

SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Required(ATTR_ACTION): cv.service,
        vol.Optional(ATTR_DATA, default=dict): dict,
        vol.Required(ATTR_DELAY): cv.positive_time_period,
    }
)

CANCEL_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional(ATTR_TIMER_ID): cv.string,
            vol.Optional(ATTR_ENTITY_ID): cv.entity_id,
        }
    ),
    cv.has_at_least_one_key(ATTR_TIMER_ID, ATTR_ENTITY_ID),
)

DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
DATA_JS_URL = f"{DOMAIN}_js_url"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register things that cannot be unregistered (websocket commands)."""
    websocket_api.async_register_command(hass, ws_subscribe)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the manager, services and frontend script."""
    manager = TimedEventManager(hass)
    await manager.async_load()
    hass.data[DOMAIN] = manager

    async def _schedule(call: ServiceCall) -> ServiceResponse:
        entity_id: str = call.data[ATTR_ENTITY_ID]
        action: str = call.data[ATTR_ACTION]
        domain, service = action.split(".", 1)
        if not hass.services.has_service(domain, service):
            raise ServiceValidationError(f"Action {action} does not exist")
        if hass.states.get(entity_id) is None:
            raise ServiceValidationError(f"Entity {entity_id} does not exist")
        data = {k: v for k, v in call.data[ATTR_DATA].items() if k != ATTR_ENTITY_ID}
        timer = manager.async_schedule(
            entity_id, action, data, call.data[ATTR_DELAY], call.context.user_id
        )
        return {"timer": timer} if call.return_response else None

    async def _cancel(call: ServiceCall) -> ServiceResponse:
        count = manager.async_cancel(
            call.data.get(ATTR_TIMER_ID), call.data.get(ATTR_ENTITY_ID)
        )
        return {"cancelled": count} if call.return_response else None

    hass.services.async_register(
        DOMAIN, SERVICE_SCHEDULE, _schedule, SCHEDULE_SCHEMA, SupportsResponse.OPTIONAL
    )
    hass.services.async_register(
        DOMAIN, SERVICE_CANCEL, _cancel, CANCEL_SCHEMA, SupportsResponse.OPTIONAL
    )

    await _async_register_frontend(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload: stop timers (they stay stored and resume on next load)."""
    hass.services.async_remove(DOMAIN, SERVICE_SCHEDULE)
    hass.services.async_remove(DOMAIN, SERVICE_CANCEL)
    if url := hass.data.pop(DATA_JS_URL, None):
        remove_extra_js_url(hass, url)
    manager: TimedEventManager = hass.data.pop(DOMAIN)
    await manager.async_shutdown()
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    if not hass.data.get(DATA_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_BASE, str(FRONTEND_DIR), False)]
        )
        hass.data[DATA_STATIC_REGISTERED] = True

    # Cache-bust with the file's mtime so browsers pick up edits after a restart.
    mtime = await hass.async_add_executor_job(
        lambda: int((FRONTEND_DIR / FRONTEND_SCRIPT).stat().st_mtime)
    )
    url = f"{FRONTEND_URL_BASE}/{FRONTEND_SCRIPT}?v={mtime}"
    add_extra_js_url(hass, url)
    hass.data[DATA_JS_URL] = url


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Stream the list of pending timers to the frontend."""
    manager: TimedEventManager | None = hass.data.get(DOMAIN)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded", "Timed Event is not set up")
        return

    @callback
    def _forward() -> None:
        connection.send_message(
            websocket_api.event_message(msg["id"], {"timers": manager.timers})
        )

    connection.subscriptions[msg["id"]] = manager.async_add_listener(_forward)
    connection.send_result(msg["id"])
    _forward()
