"""Shared rate-limiter instance.

Defined in a dedicated module to avoid circular imports between
app.main (which registers middleware) and app.routers.chat
(which applies the @limiter.limit decorator).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
