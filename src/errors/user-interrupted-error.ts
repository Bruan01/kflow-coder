// 导入 KfcError 基类
import { KfcError } from "./kfc-error.js";

// UserInterruptedError 表示用户主动中断操作（如 Ctrl+C）的错误
export class UserInterruptedError extends KfcError {
  // 构造函数：默认消息为 "Operation cancelled by user"
  constructor(message = "Operation cancelled by user") {
    // 调用父类构造函数，传入固定的分类、错误码和退出码
    super({
      category: "user_interrupted", // 分类：用户中断
      code: "USER_INTERRUPTED", // 错误码
      message, // 可自定义的消息
      exitCode: 130, // 退出码 130（Unix 惯例：128 + SIGINT=2）
      retryable: false, // 用户中断不可自动重试
    });
    this.name = "UserInterruptedError"; // 设置错误名称为 "UserInterruptedError"
  }
}
