"""Cost and abuse controls: a daily cap for everyone and a daily limit per IP.

Counts live in memory. That is enough for one server process, costs nothing and
stores nothing on disk. A restart resets the counts, which only ever errs on the
side of allowing a few more runs.
"""

import hashlib
import os
import secrets
from datetime import UTC, datetime

import httpx

DAILY_RUN_CAP = int(os.environ.get("DAILY_RUN_CAP", "100"))  # all visitors together
RUNS_PER_IP = int(os.environ.get("RUNS_PER_IP", "3"))  # one visitor, per day
# How many proxies sit between the internet and this app. See client_ip.
TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "1"))

MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB: a text resume PDF is well under this
MAX_RESUME_CHARS = 20_000  # about four dense pages
MAX_JD_CHARS = 15_000
MIN_CHARS = 200  # shorter than this is not a resume or a job description

TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "")
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
# "dev" turns the bot check off when no secret is set. Any other value keeps it on.
APP_ENV = os.environ.get("APP_ENV", "production")

# A random value made at start-up and mixed into every IP hash. The counts then
# hold no IP addresses, and a hash cannot be turned back into one.
_SALT = secrets.token_bytes(16)


class LimitReached(Exception):
    """Raised with a message that is safe and friendly enough to show a visitor."""


def client_ip(forwarded_for: str | None, peer: str) -> str:
    """The visitor's IP address, as reported by our own proxy.

    Each proxy appends the address it saw to X-Forwarded-For. A visitor can put
    anything at the front of that header, but not at the end, so we count from
    the right: with one trusted proxy, the last entry is the real address.
    """
    hops = [h.strip() for h in (forwarded_for or "").split(",") if h.strip()]
    if len(hops) >= TRUSTED_PROXY_HOPS > 0:
        return hops[-TRUSTED_PROXY_HOPS]
    return peer  # no proxy in front (local development)


class RunCounter:
    """Counts today's runs, in total and per visitor."""

    def __init__(self) -> None:
        self.day = ""
        self.total = 0
        self.per_ip: dict[str, int] = {}

    def _roll_over(self) -> None:
        today = datetime.now(UTC).date().isoformat()
        if today != self.day:  # first call of a new day: start from zero
            self.day, self.total, self.per_ip = today, 0, {}

    def claim(self, ip: str) -> None:
        """Count one run for this visitor, or raise LimitReached."""
        self._roll_over()
        key = hashlib.sha256(_SALT + ip.encode()).hexdigest()
        if self.total >= DAILY_RUN_CAP:
            raise LimitReached(
                "Today's free runs are used up. The limit resets at midnight UTC. "
                "The example page shows a full run in the meantime."
            )
        if self.per_ip.get(key, 0) >= RUNS_PER_IP:
            raise LimitReached(
                f"You have used your {RUNS_PER_IP} runs for today. "
                "The limit resets at midnight UTC."
            )
        self.total += 1
        self.per_ip[key] = self.per_ip.get(key, 0) + 1

    def refund(self, ip: str) -> None:
        """Give a run back when it failed through no fault of the visitor."""
        key = hashlib.sha256(_SALT + ip.encode()).hexdigest()
        if self.per_ip.get(key, 0) > 0:
            self.per_ip[key] -= 1
            self.total = max(0, self.total - 1)


def bot_check_enabled() -> bool:
    return bool(TURNSTILE_SECRET) or APP_ENV != "dev"


async def passes_bot_check(token: str, ip: str) -> bool:
    """Ask Cloudflare Turnstile whether this token came from a real browser."""
    if not TURNSTILE_SECRET:
        # No secret: allowed in development only. In production a missing
        # secret blocks every run, so a config mistake cannot open the door.
        return APP_ENV == "dev"
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                TURNSTILE_URL,
                data={"secret": TURNSTILE_SECRET, "response": token, "remoteip": ip},
            )
        return bool(response.json().get("success"))
    except (httpx.HTTPError, ValueError):
        return False  # cannot reach Cloudflare or bad answer: do not let the run in
