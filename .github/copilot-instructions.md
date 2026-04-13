# Copilot Instructions

## Mandatory Validation After Every Change

- After any code change in this repository, always run `make build-windows` from the repository root before sending the final response.
- If the command fails, do not consider the task complete.
- When `make build-windows` fails, fix the issue and run it again until it passes, or clearly report the blocker.

## Command

```bash
make build-windows
```
