# Rosamary Chat

基于 Next.js 和 DeepSeek AI 构建的现代化智能对话应用，具有实时对话和优雅的用户界面。

## ✨ 主要功能

- 🤖 集成 DeepSeek AI 实现智能对话
- 💬 实时对话界面，支持消息历史记录
- 🎨 美观的响应式界面，支持深色模式
- 📝 完整的 Markdown 支持，包括代码块、表格等
- 🌙 深色/浅色主题切换
- ⚡ 快速响应，性能优化
- 🔒 安全的 API 密钥处理
- 📱 移动端友好设计

## 🏗️ 技术架构

### 技术栈

- **前端框架**: Next.js 14 (App Router)
- **UI 框架**: Tailwind CSS
- **Markdown**: React Markdown (支持 GFM)
- **AI 集成**: DeepSeek API
- **样式处理**: Tailwind CSS 自定义组件

### 核心组件

- `app/components/Chat.tsx`: 主聊天界面组件
- `app/api/chat/route.ts`: 处理聊天请求的 API 路由
- `app/page.tsx`: 主页面布局
- `app/layout.tsx`: 根布局和全局样式

## 🚀 部署指南

### Vercel 部署

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 创建新项目
3. 导入你 Fork 的仓库
4. 添加 DeepSeek API 密钥到环境变量：
   - 名称: `DEEPSEEK_API_KEY`
   - 值: 你的 DeepSeek API 密钥
5. 部署！

### 本地开发

1. 克隆仓库：
   ```bash
   git clone https://github.com/GlimmerForest/chatbot.git
   cd rosamary-chat
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 创建 `.env.local` 文件：
   ```
   DEEPSEEK_API_KEY=你的API密钥
   ```

4. 启动开发服务器：
   ```bash
   npm run dev
   ```

5. 访问 [http://localhost:3000](http://localhost:3000)

## 🔧 环境变量

| 变量名 | 说明 | 是否必需 |
|--------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 是 |

## 📦 项目依赖

- `next`: 14.1.0
- `react`: 18.2.0
- `react-dom`: 18.2.0
- `react-markdown`: 10.1.0
- `remark-gfm`: 4.0.1
- `tailwindcss`: 3.4.1
- `typescript`: 5.3.3

## 🤝 贡献指南

欢迎提交 Pull Request 来改进项目！

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


