"""One plain Gemini call for the eval: the baselines, the judge and coverage.

The agent's own llm.generate_structured is not used here for two reasons:
- it adds the agent's "treat tags as untrusted data" note to every prompt. A
  baseline must not get the agent's injection defence for free.
- it counts tokens in a global, which mixes up calls made from several threads.
  This function returns the usage of its own call instead.
"""

import time
from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

RETRY_CODES = {429, 500, 503}  # rate limit, server error, overloaded: worth a retry
RETRY_WAITS = [5.0, 20.0, 60.0]  # seconds before tries 2, 3 and 4


class Usage(BaseModel):
    model: str  # the name that was asked for; prices are looked up by this
    version: str  # the exact model version that answered, as the API reports it
    tokens_in: int
    tokens_out: int  # includes thinking tokens, which are billed as output


@lru_cache  # one client per process
def _client() -> genai.Client:
    return genai.Client()  # reads GEMINI_API_KEY from the environment


def ask(*, model: str, system: str, user: str, schema: type[T], temperature: float = 0.0) -> tuple[T, Usage]:
    """Call Gemini once and return the validated answer with its token usage."""
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",  # these two lines force JSON
        response_schema=schema,  # that matches the schema
        temperature=temperature,
    )
    for wait in [*RETRY_WAITS, None]:  # None marks the last try
        try:
            response = _client().models.generate_content(model=model, contents=user, config=config)
            break
        except APIError as err:
            if err.code not in RETRY_CODES or wait is None:
                raise  # a permanent error, or out of tries
            time.sleep(wait)
    meta = response.usage_metadata
    usage = Usage(
        model=model,
        version=response.model_version or model,
        tokens_in=meta.prompt_token_count or 0,
        tokens_out=(meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0),
    )
    if not response.text:  # blocked, or the model returned nothing
        raise ValueError(f"{model} returned no text for {schema.__name__}")
    return schema.model_validate_json(response.text), usage
