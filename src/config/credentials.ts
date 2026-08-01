// 导入 Zod 验证库
import { z } from "zod";

// 导入共享的 baseUrl 验证 schema
import { providerBaseUrlSchema } from "./schema.js";

// credentialsFileSchema：凭证文件内容的 Zod 验证 schema
export const credentialsFileSchema = z
  .object({
    // 顶层对象
    provider: z //   provider 字段
      .object({
        //     也是一个对象
        baseUrl: providerBaseUrlSchema, //       baseUrl：复用共享的 URL 验证
        apiKey: z.string().trim().min(1), //       apiKey：非空去空白字符串
      })
      .strict(), //     不允许额外字段
  })
  .strict(); // 顶层也不允许额外字段

// CredentialsFileData：从 schema 推导出的 TypeScript 类型
export type CredentialsFileData = z.infer<typeof credentialsFileSchema>;
