import host
# Asyncio compatibility wrapper: prefer asyncio.run or uasyncio.run, fallback to get_event_loop().run_until_complete
try:
    import asyncio as _asyncio
    _run = getattr(_asyncio, 'run', None)
except Exception:
    _asyncio = None
    _run = None
# prefer uasyncio.run if available (MicroPython often exposes this)
try:
    import uasyncio as _ua
    if _run is None:
        _run = getattr(_ua, 'run', None)
except Exception:
    _ua = None
# fallback: use asyncio.get_event_loop().run_until_complete if present
if _run is None and _asyncio is not None:
    try:
        _loop = _asyncio.get_event_loop()
        if hasattr(_loop, 'run_until_complete'):
            def _run(coro): _loop.run_until_complete(coro)
    except Exception:
        _run = None

async def __ssg_main():
    i = 10
    if i > 5:
    	line = await host.get_input("what? ")
        print(f"Your line was: {line}")
    else:
        print("should not be reached")
if _run is None:
    raise ImportError('no async runner available')
_run(__ssg_main())