"""Timer bookkeeping: schedule, persist, fire and cancel delayed actions."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
import logging
from typing import Any
import uuid

from homeassistant.core import CALLBACK_TYPE, Context, HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import EVENT_EXECUTED, EVENT_FAILED, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class TimedEventManager:
    """Holds all pending timers and notifies subscribers about changes."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._timers: dict[str, dict[str, Any]] = {}
        self._unsubs: dict[str, CALLBACK_TYPE] = {}
        self._listeners: set[Callable[[], None]] = set()
        self._unsub_started: CALLBACK_TYPE | None = None

    @property
    def timers(self) -> list[dict[str, Any]]:
        """Pending timers, soonest first."""
        return sorted(self._timers.values(), key=lambda t: t["fire_at"])

    async def async_load(self) -> None:
        """Restore timers from storage; arm them once HA is fully started."""
        data = await self._store.async_load() or {}
        for timer in data.get("timers", []):
            self._timers[timer["id"]] = timer

        @callback
        def _arm_all(_hass: HomeAssistant) -> None:
            self._unsub_started = None
            for timer in list(self._timers.values()):
                self._arm(timer)

        # Entities may not exist yet during startup, so overdue timers wait for it.
        self._unsub_started = async_at_started(self.hass, _arm_all)

    async def async_shutdown(self) -> None:
        """Disarm everything and flush storage (timers are kept for next load)."""
        if self._unsub_started:
            self._unsub_started()
            self._unsub_started = None
        for unsub in self._unsubs.values():
            unsub()
        self._unsubs.clear()
        await self._store.async_save(self._data_to_save())

    @callback
    def async_add_listener(self, listener: Callable[[], None]) -> CALLBACK_TYPE:
        """Register a change listener; returns an unsubscribe callback."""
        self._listeners.add(listener)

        @callback
        def _remove() -> None:
            self._listeners.discard(listener)

        return _remove

    @callback
    def async_schedule(
        self,
        entity_id: str,
        action: str,
        data: dict[str, Any],
        delay: timedelta,
        user_id: str | None,
    ) -> dict[str, Any]:
        """Create a new timer and return it."""
        now = dt_util.utcnow()
        timer = {
            "id": uuid.uuid4().hex,
            "entity_id": entity_id,
            "action": action,
            "data": data,
            "created_at": now.isoformat(),
            "fire_at": (now + delay).isoformat(),
            "user_id": user_id,
        }
        self._timers[timer["id"]] = timer
        self._arm(timer)
        self._changed()
        return timer

    @callback
    def async_cancel(
        self, timer_id: str | None = None, entity_id: str | None = None
    ) -> int:
        """Cancel one timer by id, or all timers of an entity. Returns count."""
        ids = [
            t["id"]
            for t in self._timers.values()
            if (timer_id and t["id"] == timer_id)
            or (entity_id and t["entity_id"] == entity_id)
        ]
        for tid in ids:
            self._remove(tid)
        if ids:
            self._changed()
        return len(ids)

    @callback
    def _arm(self, timer: dict[str, Any]) -> None:
        fire_at: datetime = dt_util.parse_datetime(timer["fire_at"])
        timer_id = timer["id"]

        @callback
        def _fire(_now: datetime) -> None:
            self._unsubs.pop(timer_id, None)
            self.hass.async_create_task(
                self._async_fire(timer_id), f"timed_event fire {timer_id}"
            )

        # A point in the past fires right away (e.g. timers overdue after a restart).
        self._unsubs[timer_id] = async_track_point_in_utc_time(self.hass, _fire, fire_at)

    async def _async_fire(self, timer_id: str) -> None:
        timer = self._timers.pop(timer_id, None)
        if timer is None:
            return
        self._changed()

        domain, service = timer["action"].split(".", 1)
        service_data = {**timer["data"], "entity_id": timer["entity_id"]}
        event_data = {
            "id": timer_id,
            "entity_id": timer["entity_id"],
            "action": timer["action"],
            "data": timer["data"],
        }
        try:
            await self.hass.services.async_call(
                domain,
                service,
                service_data,
                blocking=True,
                context=Context(user_id=timer.get("user_id")),
            )
        except Exception as err:  # noqa: BLE001 - report any failure, keep running
            _LOGGER.error(
                "Timed action %s on %s failed: %s",
                timer["action"],
                timer["entity_id"],
                err,
            )
            self.hass.bus.async_fire(EVENT_FAILED, {**event_data, "error": str(err)})
            return
        _LOGGER.debug("Executed timed action %s on %s", timer["action"], timer["entity_id"])
        self.hass.bus.async_fire(EVENT_EXECUTED, event_data)

    @callback
    def _remove(self, timer_id: str) -> None:
        self._timers.pop(timer_id, None)
        if unsub := self._unsubs.pop(timer_id, None):
            unsub()

    @callback
    def _changed(self) -> None:
        self._store.async_delay_save(self._data_to_save, 1)
        for listener in list(self._listeners):
            listener()

    def _data_to_save(self) -> dict[str, Any]:
        return {"timers": list(self._timers.values())}
