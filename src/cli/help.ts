export function createHelpText(): string {
  return `KFlow Code (KFC)
A learning-first, verifiable coding agent.

Usage:
  kfc [options]
  kfc <command>

Commands:
  doctor            Check runtime and provider configuration
  ask <prompt...>   Send one prompt and stream the model response
  agent <prompt...> Run a read-only workspace agent (Chat Completions only)

Options:
  --quickstart      Interactively configure an OpenAI-compatible Provider
  --qs              Alias for --quickstart
  -h, --help        Show this help message
  -v, --version     Print the installed version
`;
}
