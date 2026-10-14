# secrets/

A private place to share credentials with Claude Code and other local tools.

- Put real values in `secrets/credentials.env` (copy `credentials.example.env` to start).
- That file is git-ignored and is not loaded into Docker, so it never reaches the repo or a container by accident.
- Claude reads only the key names, uses values without printing them, and asks before sending one to any outside service.
- App configuration still lives where the app reads it: Stripe keys in `backend/.env`, ngrok and MySQL settings in the root `.env`.
