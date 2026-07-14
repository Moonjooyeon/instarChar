NPM ?= npm
CAP ?= ./node_modules/.bin/cap
FRONTEND_WORKSPACE ?= apps/frontend
BACKEND_DIR ?= backend
BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8000
BACKEND_PYTHON ?= $(BACKEND_DIR)/.venv/bin/python
BACKEND_PYTEST ?= $(BACKEND_DIR)/.venv/bin/pytest
BACKEND_UVICORN ?= $(BACKEND_DIR)/.venv/bin/uvicorn
WEB_HOST ?= 127.0.0.1
WEB_PORT ?= 5173
WEB_PREVIEW_PORT ?= 4173
ANDROID_PROJECT_DIR ?= android
ANDROID_SDK_ROOT ?= $(HOME)/Library/Android/sdk
ANDROID_JAVA_HOME ?= $(shell /usr/libexec/java_home -v 21 2>/dev/null)
WEB_API_URL ?=
CAP_API_URL ?=
FRONTEND_WEB_ENV = $(if $(WEB_API_URL),VITE_API_BASE_URL=$(WEB_API_URL) )
FRONTEND_BUILD_ENV = $(if $(CAP_API_URL),VITE_API_BASE_URL=$(CAP_API_URL) )

.PHONY: help backend-dev backend-run backend-test backend-compile web-dev web-build web-preview android-java-home android-local-properties cap-doctor cap-build cap-sync cap-open-ios cap-open-android cap-run-ios cap-run-android cap-checklist

help:
	@printf '%s\n' \
		'Backend helper targets:' \
		'  make backend-dev                        Run FastAPI with reload.' \
		'  make backend-run                        Run FastAPI without reload.' \
		'  make backend-test                       Run backend pytest suite.' \
		'  make backend-compile                    Compile backend Python files.' \
		'' \
		'Web helper targets:' \
		'  make web-dev                            Run the Vite dev server.' \
		'  make web-build                          Build the frontend web bundle.' \
		'  make web-preview                        Preview the built frontend bundle.' \
		'  make android-local-properties           Write android/local.properties with sdk.dir.' \
		'' \
		'Capacitor helper targets:' \
		'  make cap-doctor                         Run non-interactive frontend/backend checks.' \
		'  make cap-build                          Build the web bundle for Capacitor.' \
		'  make cap-sync                           Build and sync web assets into native projects.' \
		'  make cap-open-ios                       Open the iOS project in Xcode.' \
		'  make cap-open-android                   Open the Android project in Android Studio.' \
		'  make cap-run-ios                        Run the iOS Capacitor app manually.' \
		'  make cap-run-android                    Run the Android Capacitor app manually.' \
		'  make cap-checklist                      Print manual cookie-session checks.' \
		'' \
		'Optional:' \
		'  BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 make backend-dev' \
		'  WEB_HOST=0.0.0.0 WEB_API_URL=http://localhost:8000/api make web-dev' \
		'  ANDROID_JAVA_HOME=$$(/usr/libexec/java_home -v 21) make cap-run-android' \
		'  ANDROID_SDK_ROOT=$$HOME/Library/Android/sdk make cap-run-android' \
		'  CAP_API_URL=http://YOUR_LAN_IP:8000/api make cap-sync' \
		'  CAP_API_URL=https://api.example.com make cap-sync'

backend-dev:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_UVICORN) app.main:app --reload --host $(BACKEND_HOST) --port $(BACKEND_PORT)

backend-run:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_UVICORN) app.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT)

backend-test:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_PYTEST) $(BACKEND_DIR)/tests

backend-compile:
	PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache $(BACKEND_PYTHON) -m compileall -q $(BACKEND_DIR)/app $(BACKEND_DIR)/tests $(BACKEND_DIR)/migrations

web-dev:
	$(FRONTEND_WEB_ENV)$(NPM) --workspace $(FRONTEND_WORKSPACE) run dev -- --host $(WEB_HOST) --port $(WEB_PORT)

web-build:
	$(FRONTEND_WEB_ENV)$(NPM) --workspace $(FRONTEND_WORKSPACE) run build

web-preview:
	$(FRONTEND_WEB_ENV)$(NPM) --workspace $(FRONTEND_WORKSPACE) run preview -- --host $(WEB_HOST) --port $(WEB_PREVIEW_PORT)

android-java-home:
	@test -n "$(ANDROID_JAVA_HOME)" || (printf 'JDK 21 not found.\nInstall JDK 21 or set ANDROID_JAVA_HOME=/path/to/jdk21 and retry.\n' && exit 1)
	@printf 'Using JDK 21 at %s\n' "$(ANDROID_JAVA_HOME)"

android-local-properties:
	@test -d "$(ANDROID_SDK_ROOT)" || (printf 'Android SDK not found: %s\nSet ANDROID_SDK_ROOT=/path/to/sdk and retry.\n' "$(ANDROID_SDK_ROOT)" && exit 1)
	@printf 'sdk.dir=%s\n' "$(ANDROID_SDK_ROOT)" > $(ANDROID_PROJECT_DIR)/local.properties
	@printf 'Wrote %s/local.properties\n' "$(ANDROID_PROJECT_DIR)"

cap-doctor:
	$(NPM) run typecheck -w $(FRONTEND_WORKSPACE)
	$(NPM) run test:domain -w $(FRONTEND_WORKSPACE)
	$(NPM) run build -w $(FRONTEND_WORKSPACE)
	$(NPM) --workspace $(FRONTEND_WORKSPACE) run test:e2e -- --list
	$(MAKE) backend-compile
	$(MAKE) backend-test

cap-build:
	$(FRONTEND_BUILD_ENV)$(NPM) run build -w $(FRONTEND_WORKSPACE)

cap-sync: cap-build
	$(CAP) sync

cap-open-ios:
	$(CAP) open ios

cap-open-android: android-local-properties
	$(CAP) open android

cap-run-ios:
	$(CAP) run ios

cap-run-android: android-java-home android-local-properties
	JAVA_HOME=$(ANDROID_JAVA_HOME) ANDROID_HOME=$(ANDROID_SDK_ROOT) ANDROID_SDK_ROOT=$(ANDROID_SDK_ROOT) $(CAP) run android

cap-checklist:
	@printf '%s\n' \
		'Manual Capacitor cookie-session checklist:' \
		'  1. Run BACKEND_HOST=0.0.0.0 make backend-dev.' \
		'  2. Set CAP_API_URL to the FastAPI origin, usually http://YOUR_LAN_IP:8000/api.' \
		'  3. Run make cap-sync.' \
		'  4. Open or run the target platform.' \
		'  5. Sign in with Google or Apple.' \
		'  6. Force-close and reopen the app.' \
		'  7. Confirm /api/auth/me still returns the logged-in user.' \
		'  8. Create or edit a character, then restart and confirm state is restored.' \
		'  9. Share/follow/delete a DM thread and confirm the backend state changes.'
