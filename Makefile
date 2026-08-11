NPM ?= npm
CAP ?= ./node_modules/.bin/cap
FRONTEND_WORKSPACE ?= apps/frontend
BACKEND_DIR ?= backend
BACKEND_HOST ?= 0.0.0.0
BACKEND_PORT ?= 8000
BACKEND_PYTHON ?= $(BACKEND_DIR)/.venv/bin/python
BACKEND_PYTEST ?= $(BACKEND_DIR)/.venv/bin/pytest
BACKEND_UVICORN ?= $(BACKEND_DIR)/.venv/bin/uvicorn
LOCAL_COMPOSE ?= docker compose -f docker-compose.local.yaml
WEB_HOST ?= 0.0.0.0
WEB_PORT ?= 5173
WEB_PREVIEW_PORT ?= 4173
ANDROID_PROJECT_DIR ?= android
ANDROID_SDK_ROOT ?= $(HOME)/Library/Android/sdk
ANDROID_ADB ?= $(ANDROID_SDK_ROOT)/platform-tools/adb
ANDROID_JAVA_HOME ?= $(shell /usr/libexec/java_home -v 21 2>/dev/null)
ANDROID_GRADLE_USER_HOME ?= $(ANDROID_PROJECT_DIR)/.gradle-user-home
WEB_API_URL ?=
CAP_API_URL ?= https://alive.imagebgremover.net
LOCAL_CAP_BASE_URL ?= http://localhost:8000
FRONTEND_WEB_ENV = $(if $(WEB_API_URL),VITE_API_BASE_URL=$(WEB_API_URL) )
FRONTEND_BUILD_ENV = $(if $(CAP_API_URL),VITE_API_BASE_URL=$(CAP_API_URL) )
FRONTEND_LOCAL_BUILD_ENV = VITE_API_BASE_URL=$(LOCAL_CAP_BASE_URL) VITE_LEGAL_BASE_URL=$(LOCAL_CAP_BASE_URL)

.PHONY: help local-up local-down local-logs local-ps backend-dev backend-run backend-test backend-compile iap-release-check web-dev web-build web-preview android-java-home android-local-properties cap-doctor cap-build cap-build-local cap-sync cap-sync-local cap-open-ios cap-open-android cap-run-ios cap-run-android cap-checklist android-bundle-release ios-archive-release

help:
	@printf '%s\n' \
		'Backend helper targets:' \
		'  make local-up                          Build and start local PostgreSQL + FastAPI.' \
		'  make local-down                        Stop local Docker services and keep data.' \
		'  make local-logs                        Follow local FastAPI logs.' \
		'  make local-ps                          Show local Docker service status.' \
		'  make backend-dev                        Run FastAPI with reload on 0.0.0.0.' \
		'  make backend-run                        Run FastAPI without reload.' \
		'  make backend-test                       Run backend pytest suite.' \
		'  make backend-compile                    Compile backend Python files.' \
		'  make iap-release-check IAP_RELEASE_MANIFEST=path.json' \
		'' \
		'Web helper targets:' \
		'  make web-dev                            Run Vite on 0.0.0.0.' \
		'  make web-build                          Build the frontend web bundle.' \
		'  make web-preview                        Preview on 0.0.0.0.' \
		'  make android-local-properties           Write android/local.properties with sdk.dir.' \
		'' \
		'Capacitor helper targets:' \
		'  make cap-doctor                         Run non-interactive frontend/backend checks.' \
		'  make cap-build                          Build the web bundle for Capacitor.' \
		'  make cap-build-local                    Build Android emulator assets for the local backend.' \
		'  make cap-sync                           Build and sync web assets into native projects.' \
		'  make cap-sync-local                     Build, sync Android, and reverse emulator port 8000.' \
		'  make cap-open-ios                       Open the iOS project in Xcode.' \
		'  make cap-open-android                   Open the Android project in Android Studio.' \
		'  make cap-run-ios                        Run the iOS Capacitor app manually.' \
		'  make cap-run-android                    Run the Android Capacitor app manually.' \
		'  make android-bundle-release             Build a signed Android App Bundle.' \
		'  make ios-archive-release                Archive iOS for App Store upload.' \
		'  make cap-checklist                      Print manual cookie-session checks.' \
		'' \
		'Optional:' \
		'  BACKEND_HOST=127.0.0.1 BACKEND_PORT=8000 make backend-dev' \
		'  WEB_HOST=127.0.0.1 WEB_API_URL=http://localhost:8000/api make web-dev' \
		'  For Google OAuth on LAN, set FRONTEND_REDIRECT_URL, FRONTEND_ORIGINS, and GOOGLE_REDIRECT_URI to the LAN URL.' \
		'  ANDROID_JAVA_HOME=$$(/usr/libexec/java_home -v 21) make cap-run-android' \
		'  ANDROID_SDK_ROOT=$$HOME/Library/Android/sdk make cap-run-android' \
		'  ANDROID_GRADLE_USER_HOME=android/.gradle-user-home make cap-run-android' \
		'  CAP_API_URL=http://YOUR_LAN_IP:8000/api make cap-sync' \
		'  CAP_API_URL=https://api.example.com make cap-sync'

local-up:
	$(LOCAL_COMPOSE) up --build -d backend

local-down:
	$(LOCAL_COMPOSE) down

local-logs:
	$(LOCAL_COMPOSE) logs -f backend

local-ps:
	$(LOCAL_COMPOSE) ps

backend-dev:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_UVICORN) app.main:app --reload --host $(BACKEND_HOST) --port $(BACKEND_PORT)

backend-run:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_UVICORN) app.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT)

backend-test:
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_PYTEST) $(BACKEND_DIR)/tests

backend-compile:
	PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache $(BACKEND_PYTHON) -m compileall -q $(BACKEND_DIR)/app $(BACKEND_DIR)/tests $(BACKEND_DIR)/migrations

iap-release-check:
	@test -n "$(IAP_RELEASE_MANIFEST)" || (printf 'Set IAP_RELEASE_MANIFEST to the completed console manifest.\n' && exit 1)
	PYTHONPATH=$(BACKEND_DIR) $(BACKEND_PYTHON) -m app.iap_release_check $(IAP_RELEASE_MANIFEST)

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

cap-build-local:
	$(FRONTEND_LOCAL_BUILD_ENV) $(NPM) run build -w $(FRONTEND_WORKSPACE)

cap-sync: cap-build
	$(CAP) sync

cap-sync-local: cap-build-local
	$(CAP) sync android
	$(ANDROID_ADB) reverse tcp:8000 tcp:8000

cap-open-ios:
	$(CAP) open ios

cap-open-android: android-local-properties
	$(CAP) open android

cap-run-ios:
	$(CAP) run ios

cap-run-android: android-java-home android-local-properties
	JAVA_HOME=$(ANDROID_JAVA_HOME) ANDROID_HOME=$(ANDROID_SDK_ROOT) ANDROID_SDK_ROOT=$(ANDROID_SDK_ROOT) GRADLE_USER_HOME=$(ANDROID_GRADLE_USER_HOME) $(CAP) run android

android-bundle-release: cap-sync android-java-home android-local-properties
	JAVA_HOME=$(ANDROID_JAVA_HOME) ANDROID_HOME=$(ANDROID_SDK_ROOT) ANDROID_SDK_ROOT=$(ANDROID_SDK_ROOT) GRADLE_USER_HOME=$(ANDROID_GRADLE_USER_HOME) $(ANDROID_PROJECT_DIR)/gradlew -p $(ANDROID_PROJECT_DIR) bundleRelease

ios-archive-release: cap-sync
	xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath ios/build/ALIVE.xcarchive archive -allowProvisioningUpdates

cap-checklist:
	@printf '%s\n' \
		'Manual Capacitor cookie-session checklist:' \
		'  1. The default API is https://alive.imagebgremover.net/api.' \
		'  2. Override CAP_API_URL only when testing another backend.' \
		'  3. Run make cap-sync.' \
		'  4. Open or run the target platform.' \
		'  5. Sign in with Google or Apple.' \
		'  6. Force-close and reopen the app.' \
		'  7. Confirm /api/auth/me still returns the logged-in user.' \
		'  8. Create or edit a character, then restart and confirm state is restored.' \
		'  9. Share/follow/delete a DM thread and confirm the backend state changes.'
