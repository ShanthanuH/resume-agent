"""Cost and abuse controls: a daily cap for everyone and a daily limit per IP.

In production the counts live in a small Redis database (Upstash, reached over
HTTPS). The app runs as a serverless function: its memory is wiped whenever the
platform stops an idle instance, so a count kept in memory would reset and let
more runs through than the cap allows. In development the counts live in memory.
"""

import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime

import httpx

# This is a demo, not a public tool: three live runs a day for the whole site
# keeps the model bill near zero. The example page carries everyone else.
DAILY_RUN_CAP = int(os.environ.get("DAILY_RUN_CAP", "3"))  # all visitors together
# One run per visitor, so a single person cannot use up the whole day.
RUNS_PER_IP = int(os.environ.get("RUNS_PER_IP", "1"))
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

# Where the counts are kept in production. The Upstash integration on Vercel
# sets these two variables by itself.
REDIS_URL = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL", "")
REDIS_TOKEN = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")

# A secret value mixed into every IP hash, so the counts hold no IP addresses
# and a hash cannot be matched back to one. With Redis it must be the same on
# every server instance, so it is derived from the Redis token. In memory, a
# random value made at start-up is enough.
_SALT = hashlib.sha256(REDIS_TOKEN.encode()).digest() if REDIS_TOKEN else secrets.token_bytes(16)


def _ip_key(ip: str) -> str:
    return hashlib.sha256(_SALT + ip.encode()).hexdigest()[:32]


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


# A password for the site's owner. A request that carries it in the x-owner-key
# header skips the run limits (not the bot check). Empty means no bypass exists.
OWNER_KEY = os.environ.get("OWNER_KEY", "")


def is_owner(header: str | None) -> bool:
    """True if the request carries the owner key. The key is never logged."""
    if not OWNER_KEY or not header:
        return False  # no key configured, or none sent: nobody is the owner
    # compare_digest takes the same time whether the strings differ at the first
    # character or the last, so response timing cannot be used to guess the key.
    return hmac.compare_digest(header.encode(), OWNER_KEY.encode())


LIMIT_MESSAGE = "Demo limit reached for today. See the full example."
UNAVAILABLE_MESSAGE = "Live runs are not available right now. See the full example."


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
    """Counts today's runs, in total and per visitor. In memory: for development."""

    def __init__(self) -> None:
        self.day = ""
        self.total = 0
        self.per_ip: dict[str, int] = {}

    def _roll_over(self) -> None:
        today = _today()
        if today != self.day:  # first call of a new day: start from zero
            self.day, self.total, self.per_ip = today, 0, {}

    # async only so it can be swapped for RedisCounter, which has to wait on
    # the network.
    async def claim(self, ip: str) -> None:
        """Count one run for this visitor, or raise LimitReached."""
        self._roll_over()
        key = _ip_key(ip)
        # One message for both limits. The browser adds a link to the example page.
        if self.total >= DAILY_RUN_CAP or self.per_ip.get(key, 0) >= RUNS_PER_IP:
            raise LimitReached(LIMIT_MESSAGE)
        self.total += 1
        self.per_ip[key] = self.per_ip.get(key, 0) + 1

    async def refund(self, ip: str) -> None:
        """Give a run back when it failed through no fault of the visitor."""
        key = _ip_key(ip)
        if self.per_ip.get(key, 0) > 0:
            self.per_ip[key] -= 1
            self.total = max(0, self.total - 1)


class RedisCounter:
    """The same counts, kept in Redis so every server instance shares them."""

    async def _send(self, *commands: list[str]) -> list[int]:
        """Run several Redis commands in one HTTPS request and return their results."""
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.post(
                f"{REDIS_URL}/pipeline",
                headers={"Authorization": f"Bearer {REDIS_TOKEN}"},
                json=list(commands),
            )
        response.raise_for_status()
        return [item["result"] for item in response.json()]

    def _keys(self, ip: str) -> tuple[str, str]:
        # The date is part of the key, so a new day starts from zero by itself.
        day = _today()
        return f"runs:{day}:total", f"runs:{day}:ip:{_ip_key(ip)}"

    async def claim(self, ip: str) -> None:
        total_key, ip_key = self._keys(ip)
        try:
            # INCR adds one and returns the new value as a single atomic step, so
            # two visitors arriving together can never both get the last run.
            # EXPIRE deletes the keys after two days: nothing piles up.
            total, mine, *_ = await self._send(
                ["INCR", total_key],
                ["INCR", ip_key],
                ["EXPIRE", total_key, "172800"],
                ["EXPIRE", ip_key, "172800"],
            )
        except (httpx.HTTPError, KeyError, ValueError) as err:
            # Cannot count, so cannot enforce the budget: refuse the run.
            raise LimitReached(UNAVAILABLE_MESSAGE) from err
        if total > DAILY_RUN_CAP or mine > RUNS_PER_IP:
            await self.refund(ip)  # undo the two INCRs above
            raise LimitReached(LIMIT_MESSAGE)

    async def refund(self, ip: str) -> None:
        total_key, ip_key = self._keys(ip)
        try:
            await self._send(["DECR", total_key], ["DECR", ip_key])
        except httpx.HTTPError:
            pass  # the worst case is one run fewer today


class ClosedCounter:
    """Used in production when no Redis is configured: every run is refused.

    A missing setting must never mean unlimited paid model calls.
    """

    async def claim(self, ip: str) -> None:
        raise LimitReached(UNAVAILABLE_MESSAGE)

    async def refund(self, ip: str) -> None:
        pass


def make_counter() -> RunCounter | RedisCounter | ClosedCounter:
    if REDIS_URL and REDIS_TOKEN:
        return RedisCounter()
    return RunCounter() if APP_ENV == "dev" else ClosedCounter()


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
