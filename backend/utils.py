import time
# ---------------------- small helpers -------------------------
def now_ms() -> int:
    return int(time.time() * 1000)


def make_id() -> int:
    # simple numeric id generator
    return now_ms()