# This package contains the shared integration foundation and provider-specific
# implementations added in Phase 3.
#
# Directory layout (populated incrementally across Phase 3 steps):
#
#   integrations/
#     __init__.py           ← this file
#     crypto.py             ← Fernet-based credential encryption (Phase 3.1)
#     oauth_state.py        ← OAuth state generation/validation     (Phase 3.2)
#     deps.py               ← FastAPI dependencies for integrations  (Phase 3.3+)
#     routes/               ← API route modules                      (Phase 3.4+)
#     providers/
#       google/             ← Google OAuth + Gmail client            (Phase 3.4+)
