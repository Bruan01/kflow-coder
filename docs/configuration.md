## Interactive DIY Setup

Run `kfc --quickstart` or `kfc --qs` to choose a supported wire protocol and enter a custom Base URL, model, and timeout. The wizard has no vendor presets, previews the exact JSON, refuses silent overwrite, and writes atomically with private permissions. See `docs/quickstart.md`.

# KFC Configuration

KFC currently supports one `openai-compatible` provider. Ordinary configuration is resolved in this order:

```text
environment variables > user config file > program defaults
```

The API Key uses a separate precedence rule:

```text
KFC_API_KEY > private credentials file
```

## Environment Variables

| Variable               |                          Required | Purpose                                                                       |
| ---------------------- | --------------------------------: | ----------------------------------------------------------------------------- |
| `KFC_API_KEY`          | unless stored in credentials file | Provider credential; overrides the credentials file                           |
| `KFC_PROTOCOL`         |                                no | `openai-chat-completions` or `openai-responses`; defaults to Chat Completions |
| `KFC_BASE_URL`         |                unless set in file | OpenAI-compatible API base URL                                                |
| `KFC_MODEL`            |                unless set in file | Model identifier                                                              |
| `KFC_TIMEOUT_MS`       |                                no | Request timeout, 1,000–300,000 ms; default 60,000                             |
| `KFC_CONFIG_PATH`      |                                no | Explicit configuration file path                                              |
| `KFC_CREDENTIALS_PATH` |                                no | Explicit private credentials file path                                        |

Copy `.env.example` as a reference, but do not commit a populated `.env` file.

## User Configuration File

Default location:

```text
~/.config/kfc/config.json
```

`XDG_CONFIG_HOME` is respected. A valid file looks like:

```json
{
  "provider": {
    "type": "openai-compatible",
    "protocol": "openai-chat-completions",
    "baseUrl": "https://your-provider.example/v1",
    "model": "your-model-name",
    "timeoutMs": 60000
  }
}
```

`apiKey` is deliberately forbidden in this file. Secrets must not enter source control, synced configuration, screenshots, errors, or learning snapshots.

## Credentials File

Quickstart may store the API Key separately at:

```text
~/.config/kfc/credentials.json
```

The file is written atomically with mode `0600` and binds the credential to the configured Base URL:

```json
{
  "provider": {
    "baseUrl": "https://your-provider.example/v1",
    "apiKey": "<plaintext credential>"
  }
}
```

KFC refuses a stored credential when its Base URL differs from the active Provider. `KFC_API_KEY` takes precedence and prevents the credentials file from being read. The credentials file is plaintext despite its private permissions; it must remain outside source control, snapshots, screenshots, logs, and synced configuration.

To use the Responses adapter, set the exact protocol value without changing the provider type:

```json
{
  "provider": {
    "type": "openai-compatible",
    "protocol": "openai-responses",
    "baseUrl": "https://api.openai.com/v1",
    "model": "your-responses-model",
    "timeoutMs": 60000
  }
}
```

If the protocol is omitted, KFC keeps the backward-compatible `openai-chat-completions` default. It never infers a protocol from Base URL, model name, response shape, or a failed request.

## First P1 Integration Target

As of 2026-07-31, the first real provider target is DeepSeek V4 Flash:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-flash
```

This is a replaceable configuration choice, not a Core dependency. The official model name and Chat Completions protocol were re-verified on 2026-07-31; see `docs/decisions/ADR-0002-deepseek-v4-first-provider.md`.
