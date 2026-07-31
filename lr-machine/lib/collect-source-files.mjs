import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

export const MAX_SOURCE_BYTES = 64 * 1024;
export const MAX_SOURCE_LINES = 500;

const FILE_METADATA = {
  "src/cli.ts": {
    group: "CLI 执行链",
    description: "进程适配入口：连接 argv、stdout、stderr、版本和退出码。",
  },
  "src/cli/parse-args.ts": {
    group: "CLI 执行链",
    description: "将原始参数字符串转换为 help、version 或 error 等结构化命令。",
  },
  "src/cli/run-cli.ts": {
    group: "CLI 执行链",
    description: "执行结构化命令，通过注入的环境输出文本并返回退出码。",
  },
  "src/cli/help.ts": {
    group: "输出与元数据",
    description: "集中生成 CLI 帮助文本，避免入口文件承担展示细节。",
  },
  "src/cli/package-version.ts": {
    group: "输出与元数据",
    description: "从 package.json 读取并验证唯一版本来源。",
  },
  "src/index.ts": {
    group: "模块入口",
    description: "供其他程序导入 KFC 能力的包入口。",
  },
  "src/config/config.ts": {
    group: "CONFIG 模块",
    description: "定义最终配置、结构化问题和配置错误的领域类型。",
  },
  "src/config/config-path.ts": {
    group: "CONFIG 模块",
    description: "根据显式路径、XDG 和用户目录确定配置文件位置。",
  },
  "src/config/schema.ts": {
    group: "CONFIG 模块",
    description: "使用 Zod 描述配置文件与最终合并结果的有效形状。",
  },
  "src/config/load-config.ts": {
    group: "CONFIG 模块",
    description: "读取可选文件、合并环境变量与默认值并返回校验后的配置。",
  },
  "src/config/redact-config.ts": {
    group: "CONFIG 模块",
    description: "在配置离开安全边界前替换 API Key。",
  },
  "src/errors/kfc-error.ts": {
    group: "ERROR 边界",
    description:
      "定义跨模块稳定的错误类别、代码、退出码、重试属性和安全序列化。",
  },
  "src/errors/provider-error.ts": {
    group: "ERROR 边界",
    description: "描述 Provider 失败并根据错误码确定是否值得重试。",
  },
  "src/errors/user-interrupted-error.ts": {
    group: "ERROR 边界",
    description: "把用户取消建模为退出码 130 的显式领域状态。",
  },
  "src/errors/error-presentation.ts": {
    group: "ERROR 边界",
    description: "归一化未知异常并生成默认安全、Debug 脱敏的 CLI 输出。",
  },
  "src/errors/index.ts": {
    group: "ERROR 边界",
    description: "集中导出统一错误模块的公共接口。",
  },
  "src/doctor/doctor.ts": {
    group: "DOCTOR 诊断",
    description: "生成本地运行时与配置健康检查，并格式化通过、警告和失败状态。",
  },
  "src/doctor/create-doctor-dependencies.ts": {
    group: "DOCTOR 诊断",
    description: "连接真实 Node 版本、用户目录、配置文件访问和配置加载器。",
  },
  "src/doctor/index.ts": {
    group: "DOCTOR 诊断",
    description: "集中导出 Doctor 报告、依赖和格式化接口。",
  },
  "src/quickstart/quickstart.ts": {
    group: "QUICKSTART 引导",
    description:
      "组织纯 DIY Provider 输入、预览、确认、写入和 Doctor 复用流程。",
  },
  "src/quickstart/terminal-prompt.ts": {
    group: "QUICKSTART 引导",
    description:
      "使用 readline/promises 把真实 TTY 输入输出适配为可测试 Prompt。",
  },
  "src/quickstart/write-config.ts": {
    group: "QUICKSTART 引导",
    description: "校验非秘密配置并通过 0600 临时文件与原子 rename 安全写入。",
  },
  "src/quickstart/create-quickstart-dependencies.ts": {
    group: "QUICKSTART 引导",
    description: "连接配置路径、TTY、文件访问、原子写入和现有 Doctor。",
  },
  "src/quickstart/index.ts": {
    group: "QUICKSTART 引导",
    description: "集中导出 Quickstart 的公共接口。",
  },
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(path);
    }
  }

  return files;
}

function truncateSource(content) {
  const allLines = content.split(/\r?\n/);
  const selected = allLines.slice(0, MAX_SOURCE_LINES);
  let rendered = selected.join("\n");

  while (
    selected.length > 0 &&
    Buffer.byteLength(rendered, "utf8") > MAX_SOURCE_BYTES
  ) {
    selected.pop();
    rendered = selected.join("\n");
  }

  return {
    content: rendered,
    lineCount: allLines.length,
    shownLineCount: selected.length,
    truncated: selected.length < allLines.length,
  };
}

function fallbackMetadata(path) {
  const segments = path.split("/");
  const directory = segments.length > 2 ? segments[1] : "root";
  return {
    group:
      directory === "root" ? "模块入口" : `${directory.toUpperCase()} 模块`,
    description: "KFC 当前源码模块；职责会随真实实现逐步明确。",
  };
}

export async function collectSourceFiles(projectRoot) {
  const sourceRoot = resolve(projectRoot, "src");
  const files = await walk(sourceRoot);
  const collected = [];

  for (const file of files.sort()) {
    const path = relative(projectRoot, file).split("\\").join("/");
    const source = truncateSource(await readFile(file, "utf8"));
    const metadata = FILE_METADATA[path] ?? fallbackMetadata(path);
    collected.push({ path, ...metadata, ...source });
  }

  return collected;
}
