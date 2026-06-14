import json

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

REQUEST_TIMEOUT_SECONDS = 30.0


async def chat_completion(messages: list[dict]) -> dict:
    """Call the configured OpenAI-compatible chat completions endpoint.

    Returns a dict with keys: content, prompt_tokens, completion_tokens, total_tokens.
    Raises HTTPException with a clean message on provider/timeout errors.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLM provider is not configured",
        )

    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.openai_model,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI provider took too long to respond. Please try again.",
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the AI provider. Please try again later.",
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an error. Please try again later.",
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
    except (KeyError, IndexError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Received an unexpected response from the AI provider.",
        )

    return {
        "content": content,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
    }


async def stream_chat_completion(messages: list[dict]):
    """Stream tokens from the configured OpenAI-compatible chat completions endpoint.

    This is an async generator that yields content delta strings one chunk at a time.
    Each yielded value is a raw text fragment (one or more characters) as returned by
    the provider.  The caller is responsible for wrapping chunks in SSE format.

    Raises HTTPException on configuration / network / provider errors that occur
    *before* the stream begins.  Errors occurring mid-stream are silently dropped
    to avoid corrupting an already-started HTTP response.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLM provider is not configured",
        )

    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.openai_model,
        "messages": messages,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="The AI provider returned an error. Please try again later.",
                    )

                async for line in response.aiter_lines():
                    # Each SSE line from the provider looks like:  data: {...}
                    if not line.startswith("data:"):
                        continue

                    raw = line[len("data:"):].strip()

                    if raw == "[DONE]":
                        return

                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (KeyError, IndexError, ValueError, json.JSONDecodeError):
                        # Malformed chunk — skip silently
                        continue

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI provider took too long to respond. Please try again.",
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the AI provider. Please try again later.",
        )
