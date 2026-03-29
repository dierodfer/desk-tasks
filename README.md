# Desk Tasks

![Desk Tasks App Icon](build/appicon.png)

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![Wails](https://img.shields.io/badge/Wails-v2.12.0-181B34?logo=wails&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-149ECA?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4.21-646CFF?logo=vite&logoColor=white)
![BoltDB](https://img.shields.io/badge/BoltDB-v1.4.3-3A3A3A)

**The lightest desktop app** to manage your daily tasks.

- **Works on all major operating systems**
- **No installation required**
- **No account needed**

Your data stays on your device.
**No overhead. Just execution.**

## Prerequisites

- Go 1.26+
- Node.js 22+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

## Run Locally

### 1) Verify toolchain

```bash
go version
node --version
npm --version
wails doctor
```

### 2) Install project dependencies

```bash
go mod download
cd frontend && npm install
cd ..
```

### 3) Start development mode

```bash
make dev
```

### 4) Build production binary

```bash
make build
```

Output binary: `build/bin/`

## Useful Make Targets

- `make build-linux-amd64`: Builds Linux AMD64 binary.
- `make build-windows`: Builds Windows AMD64 binary.
- `make build-windows-installer`: Builds Windows installer (NSIS required).
- `make build-macos-universal`: Builds universal macOS app.

## Project Structure

```text
desk-tasks/
├── app.go
├── main.go
├── Makefile
├── go.mod
├── wails.json
├── build/
│   ├── appicon.png
│   ├── darwin/
│   └── windows/
│       ├── icon.ico
│       └── installer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── wailsjs/
│   └── wailsjs/
```

## Architecture

```mermaid
flowchart LR

	subgraph Frontend[Frontend React]
		AppTsx[App.tsx]
	end

	subgraph Bridge[Wails bindings]
		FEWails[frontend/src/wailsjs]
		GoWails[wailsjs/go/main/App]
		FEWails <--> GoWails
	end

	subgraph Backend[Backend Go]
		AppGo[app.go]
		Bolt[(BoltDB)]
		AppGo --> Bolt
	end

	AppTsx --> FEWails
	GoWails --> AppGo
```

## CI/CD

A GitHub Actions workflow runs when a GitHub Release is published, syncs VERSION from the release tag, and builds release binaries for Windows, macOS, and Linux. Binaries are automatically attached as release assets.
