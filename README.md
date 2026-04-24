# Cloudflare Wireframe Todo

一个可直接部署到 Cloudflare 的 ToDo 列表项目：

- 前端：Vite + React + Tailwind
- 托管：Cloudflare Pages
- API：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 附件存储：Cloudflare R2

界面风格参考了 `wireframe-ui` 的结构化原型设计思路，但这里已经是可用的真实业务页面，不是纯占位骨架。

## 本地开发

```bash
npm install
npm run dev
```

如果要连同 Cloudflare Functions 一起本地预览：

```bash
npm run build
npm run cf:dev
```

## Cloudflare 资源准备

1. 创建 D1 数据库

```bash
npx wrangler d1 create todo-db
```

2. 把返回的 `database_id` 填进 [wrangler.toml](/root/dev/ToDo/wrangler.toml)

3. 初始化表结构

```bash
npx wrangler d1 execute todo-db --remote --file=schema.sql
```

4. 创建 R2 Bucket

```bash
npx wrangler r2 bucket create todo-snapshots
```

## 部署

```bash
npm run deploy
```

更常见的做法是把仓库接到 Cloudflare Pages，然后配置：

- Build command: `npm run build`
- Build output directory: `dist`

Pages 会自动识别 `functions/` 目录下的 API。

## API 概览

- `GET /api/todos` 读取任务、统计信息和附件列表
- `POST /api/todos` 创建任务
- `PATCH /api/todos/:id` 更新任务状态或内容
- `DELETE /api/todos/:id` 删除任务
- `POST /api/todos/:id/attachments` 上传任务附件到 R2
- `DELETE /api/attachments/:id` 删除任务附件
- `GET /api/attachments/:id/file` 读取附件文件
