// createHelpText：生成并返回 KFC CLI 的帮助文本字符串
export function createHelpText(): string {
  // 返回模板字符串定义的帮助文本，包含项目简介、用法、命令列表和选项列表
  return `KFlow Code (KFC)
A learning-first, verifiable coding agent.

Usage:
  kfc [options]
  kfc <command>

Commands:
  doctor            Check runtime and provider configuration
  ask <prompt...>   Send one prompt and stream the model response
  agent <prompt...> Run a bounded workspace agent (Chat Completions only)

Options:
  --quickstart      Interactively configure an OpenAI-compatible Provider
  --qs              Alias for --quickstart
  -h, --help        Show this help message
  -v, --version     Print the installed version
`;
}
