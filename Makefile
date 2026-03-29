# Ensure Go bin is in PATH (for wails CLI)
export PATH := $(HOME)/go/bin:$(PATH)
WAILS := $(shell command -v wails 2>/dev/null || command -v wails.exe 2>/dev/null || echo $(HOME)/go/bin/wails)

.PHONY: dev build build-windows build-windows-installer build-macos-universal build-linux-amd64 version-get version-set clean

# dev: Lanza la aplicación en modo desarrollo con hot-reload.
#      Los cambios en Go recompilan automáticamente.
#      Los cambios en frontend se recargan en vivo.
#      Usa este comando para desarrollar y probar la app.
dev:
	$(WAILS) dev -tags webkit2_41

# build: Compila la aplicación como binario de producción.
#        El resultado queda en build/bin/.
#        Usa este comando para generar el ejecutable final.
build:
	$(WAILS) build -tags webkit2_41

# build-windows: Compila el ejecutable para Windows (sin instalador).
build-windows:
	$(WAILS) build -platform windows/amd64 -clean

# build-windows-installer: Genera instalador NSIS para Windows.
build-windows-installer:
	$(WAILS) build -platform windows/amd64 -nsis -clean

# build-macos-universal: Compila app universal para macOS.
build-macos-universal:
	$(WAILS) build -platform darwin/universal -clean

# build-linux-amd64: Compila binario para Linux AMD64.
build-linux-amd64:
	$(WAILS) build -platform linux/amd64 -tags webkit2_41 -clean

# version-get: Muestra la version actual leida del archivo VERSION.
version-get:
	@tr -d '[:space:]' < VERSION

# version-set: Actualiza VERSION. Uso: make version-set NEW_VERSION=1.2.3
version-set:
	@if [ -z "$(NEW_VERSION)" ]; then \
		echo "ERROR: NEW_VERSION is required (example: make version-set NEW_VERSION=1.2.3)"; \
		exit 1; \
	fi
	@printf '%s\n' "$(NEW_VERSION)" > VERSION

# clean: Elimina artefactos de compilación (binarios, dist, node_modules).
clean:
	rm -rf build/bin
	rm -rf frontend/dist
	rm -rf frontend/node_modules
