# Desk Tasks

A lightweight desktop task planner built with [Wails](https://wails.io/), Go, React, and bbolt.

![Desk Tasks App Icon](build/appicon.png)

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![Wails](https://img.shields.io/badge/Wails-v2.12.0-181B34?logo=wails&logoColor=white)
![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![BoltDB](https://img.shields.io/badge/BoltDB-v1.4.3-3A3A3A)

## Features

- **Inline task creation** — press `+`, type a name, hit Enter
- **Priority ordering** — High → Medium → Low with stable sort
- **Inline editing** — click any field to edit in place
- **Local persistence** — bbolt stores tasks on disk
- **Collapsible completed section** — keeps your view clean
- **No backend server** — fully offline desktop app

## Prerequisites

- Go 1.26+
- Node.js 22+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

## Development

```bash
make dev
```

## Build

```bash
make build
```

The binary will be in `build/bin/`.

## Clean

```bash
make clean
```

## CI/CD

A GitHub Actions workflow builds release binaries for Windows and macOS when a GitHub Release is created. Binaries are automatically attached as release assets.
