# Task 2: .env.sample + Startup Validation

**Status:** DONE

## What Was Implemented

1. **`.env.sample`** at project root — documents all 8 environment variables with sensible dev defaults.
2. **Startup validation** in `backend/app/auth/config.py` — raises `RuntimeError` if `JWT_SECRET` is the dev default and `ENVIRONMENT` is not `"development"`.

## Files Changed

- `.env.sample` (new)
- `backend/app/auth/config.py` (added 9 lines after line 39)

## Concerns

None. Validation only blocks non-development environments, so existing dev setups are unaffected.

## Git Commit

`41e74ee`
