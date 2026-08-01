// 从 Node.js fs 模块导入同步读取文件的函数
import { readFileSync } from "node:fs";

// PackageMetadata 接口：描述 package.json 中我们关心的字段
interface PackageMetadata {
  version?: unknown; // version 字段可以是任意类型（我们稍后做运行时校验）
}

// readPackageVersion：读取并返回 package.json 中的 version 字段
export function readPackageVersion(
  // 默认参数：相对于当前模块文件向上两级找到 package.json（ESM 环境用 import.meta.url）
  packageUrl = new URL("../../package.json", import.meta.url),
): string {
  // 同步读取文件，解析 JSON，类型断言为 PackageMetadata
  const metadata = JSON.parse(
    readFileSync(packageUrl, "utf8"),
  ) as PackageMetadata;
  // 运行时校验：version 必须是长度大于 0 的字符串
  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("package.json does not contain a valid version");
  }
  // 返回版本号字符串
  return metadata.version;
}
