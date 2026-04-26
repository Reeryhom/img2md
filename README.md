# img2md

图片转 Markdown CLI 工具，支持 Anthropic (Kimi) 和 Minimax 两种 API 提供商。

## 功能特性

- **双 Provider 支持**：Anthropic (Kimi) 和 Minimax
- **批量处理**：支持 glob 模式，最多 3 并发
- **图片压缩**：大于 5MB 自动压缩，使用精确比例计算
- **重试机制**：指数退避，支持超时/429/5xx 错误自动重试
- **输出模式**：文件/目录/stdout
- **日志记录**：可选 `--log` 文件记录详细日志

## 安装

```bash
npm install
npm run build
npm link
```

## 配置

配置文件位置（按优先级）：

1. CLI 传参: `--config <path>`
2. `~/.img2md/settings.json`
3. `./.img2md/settings.json`

参考 `.img2md/settings.example.json` 创建配置文件：

```json
{
  "provider": "anthropic",
  "anthropic": {
    "base_url": "https://api.kimi.com/coding/",
    "api_key": "your-api-key-here",
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 8192
  },
  "minimax": {
    "api_host": "https://api.minimaxi.com",
    "api_key": "your-api-key-here"
  },
  "compression": {
    "enabled": true,
    "max_size_mb": 5,
    "quality": 80
  },
  "retry": {
    "max_retries": 3,
    "base_delay_ms": 1000,
    "timeout_ms": 30000
  },
  "output": {
    "format": "markdown"
  }
}
```

### 配置说明

| 字段 | 描述 |
|------|------|
| `provider` | API 提供商：`anthropic` 或 `minimax` |
| `anthropic` | Anthropic/Kimi API 配置 |
| `minimax` | Minimax API 配置 |

## 使用方法

```bash
# 使用 Minimax
img2md input.png -p "描述这张图片" --provider minimax

# 使用 Anthropic (默认)
img2md input.png -p "描述这张图片"

# 单个图片 - 输出到文件
img2md input.png -o output.md -p "描述这张图片"

# 单个图片 - 输出到 stdout
img2md input.png -p "描述这张图片"

# 批量处理 - 输出到目录
img2md "*.png" -o ./markdown/ -p "描述这些图片"

# 批量处理 - 输出到 stdout
img2md "*.png" -p "描述这些图片"

# 指定日志文件
img2md "*.png" --log error.log -p "描述这些图片"

# 覆盖压缩参数
img2md input.jpg --max-size 10 --quality 85 -p "描述这张图片"
```

## CLI 选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `-p, --prompt <text>` | 图片分析提示词（必填） | - |
| `-o, --output <path>` | 输出文件或目录 | stdout |
| `--log <file>` | 日志文件路径 | - |
| `--max-size <mb>` | 压缩阈值 (MB) | 5 |
| `--quality <n>` | JPEG 质量 (1-100) | 80 |
| `--provider <provider>` | API 提供商：`anthropic` 或 `minimax` | anthropic |

## 测试

```bash
npm test
```

## 项目结构

```
img2md/
├── src/
│   ├── index.ts        # CLI 入口
│   ├── client.ts       # Anthropic API 客户端
│   ├── minimax.ts      # Minimax API 客户端
│   ├── compressor.ts   # 图片压缩
│   ├── batch.ts        # 批量处理
│   ├── config.ts       # 配置加载
│   └── types.ts        # TypeScript 类型
├── __tests__/          # 测试文件
├── .img2md/
│   └── settings.example.json  # 配置示例
├── package.json
└── tsconfig.json
```

## 图片压缩说明

当图片大于 5MB 时自动压缩：

1. 计算精确缩放比例：`ratio = sqrt(maxBytes / currentBytes)`
2. 按比例缩放后重新编码为 JPEG (quality 80, progressive)

## 重试机制

API 请求失败时自动重试：

- **可重试错误**：429 (限流), 500, 502, 503, 504, timeout
- **退避策略**：指数退避，延迟 = baseDelay * 2^attempt
- **最大重试**：3 次

## License

MIT
