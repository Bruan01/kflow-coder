# KFC Doctor

`kfc doctor` verifies that the local runtime and single OpenAI-compatible Provider configuration are ready for future model calls. It does not contact DeepSeek or any external service.

## Checks

- Node.js is version 22 or newer.
- The resolved config file path is accessible or environment/default configuration can be used.
- Provider Base URL is valid.
- Model is present.
- API Key is present, without showing its value.

## Usage

```bash
kfc doctor
```

Repository-local equivalent:

```bash
pnpm build
pnpm kfc doctor
```

A missing config file is a warning because environment variables can provide ordinary configuration. The API Key may come from `KFC_API_KEY` or the private credentials file. Missing or invalid required values are failures and return exit code `2`.

## Example

```text
KFC Doctor

✓ Node.js      v24.14.0
! Config file  ~/.config/kfc/config.json not found; using environment/defaults
✓ Base URL     https://api.deepseek.com
✓ Model        deepseek-v4-flash
✓ API Key      present
```

Doctor reports local readiness only. Provider authentication, network reachability, model availability, streaming, and Tool Calling belong to P1 integration tests.
