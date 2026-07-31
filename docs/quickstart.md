# KFC Quickstart

Quickstart interactively creates a custom OpenAI-compatible Provider configuration. It contains no vendor presets.

## Usage

```bash
kfc --quickstart
```

Alias:

```bash
kfc --qs
```

The wizard asks for:

1. Wire protocol: `openai-chat-completions` or `openai-responses`.
2. Base URL using `http://` or `https://`.
3. Model identifier.
4. Timeout between 1,000 and 300,000 milliseconds.
5. Confirmation after displaying the exact non-secret JSON preview.
6. API Key through hidden terminal input after accepting the plaintext-storage warning.

The generated provider block explicitly records the selected protocol. Pressing Enter keeps the backward-compatible `"openai-chat-completions"` default. Quickstart does not guess a protocol from the Base URL or model name.

It resolves the target path using `KFC_CONFIG_PATH`, `XDG_CONFIG_HOME`, or `~/.config/kfc/config.json`. Existing files are never silently overwritten. The parent directory and file are created with private permissions, and the JSON is written through a temporary file followed by an atomic rename.

## Secret Boundary

Quickstart never puts an API Key in `config.json` or terminal output. After previewing the non-secret configuration, it warns that the credential will be stored as plaintext and requires explicit confirmation before asking for it through hidden TTY input.

The credential is written separately to:

```text
~/.config/kfc/credentials.json
```

That file is Base-URL-bound, atomically replaced, and created with mode `0600`. It is still plaintext and must not enter source control, LR Machine, snapshots, screenshots, or synced configuration. `KFC_API_KEY` remains the higher-priority alternative and prevents the stored file from being read.

## Non-interactive Environments

Quickstart requires both stdin and stdout to be TTYs. Piped or redirected execution fails with exit code `1` rather than waiting indefinitely for input.
