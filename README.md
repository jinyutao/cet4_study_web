# CET-4 背单词网站

基于间隔重复 (SM-2) 算法的自适应 CET-4 词汇学习系统。Docker 部署，局域网内访问。

> **构建约束**：所有前端和后端的编译构建**必须**在 Docker 容器内完成，禁止使用宿主机 Node.js 执行构建。
> 宿主机不安装 `node_modules/`，所有依赖在 Docker 镜像构建时通过 `npm ci` 安装。

## 快速开始

```bash
# 启动服务
bash start.sh

# 测试模式（50 词小数据库）
bash start.sh --test

# 修改前端源码后刷新
bash start.sh build          # 容器内构建前端
# 然后刷新浏览器即可看到效果

# 重置用户密码
bash start.sh reset-password zhangsan

# 修复文件所有权（容器创建的文件可能归属 root）
bash start.sh fix-ownership
```

- 访问地址：`http://<server-ip>:9098`
- 测试账号：`test / test123`（管理员，仅 `--test` 模式）
- 端口：9098

## 页面

| 路径 | 说明 |
|------|------|
| `/` | 访客模式 / 仪表盘 |
| `/login` | 登录注册 |
| `/dashboard` | 今日任务、总体进度、热力图 |
| `/learn` | 学习闯关（选择新词模式 → 复习 → 新词 → 总测 → 结算） |
| `/progress` | 轮次进度、熟练度分布 |
| `/settings` | 学习参数、时间估算 |
| `/admin` | 用户管理（需管理员权限） |

## 开发

> **⚠️ 所有编译必须在 Docker 容器内完成**，宿主机不执行任何 `npm run build` / `npx tsx` 操作。

```bash
# 完整重构建镜像（编译后端 TypeScript + 构建前端），然后启动
bash start.sh                      # 构建并启动
bash start.sh --test               # 测试模式（50 词）

# 仅构建前端，改前端源码后热更新用（不重启容器）
# 注：后端代码修改后必须通过 bash start.sh（完整重构建镜像），bash start.sh build 只处理前端
bash start.sh build                # 容器内构建前端

# 种子数据（均通过 Docker 容器执行）
bash start.sh --test               # 测试模式自动创建 50 词测试库
docker exec docker-cet4-web-1 node /app/dist/scripts/seed.js                  # 完整 4517 词
docker exec -e DB_PATH=/app/data/cet4_test.db docker-cet4-web-1 node /app/dist/scripts/seed_test.js  # 50 词
```

## 数据库

| 文件 | 用途 | 词数 |
|------|------|------|
| `data/cet4.db` | 正式数据库 | 4517 |
| `data/cet4_test.db` | B/C/W 首字母（B:17, C:17, W:16） | 50 |
| `data/cet4_test_afjz.db` | A/F/J/Z 首字母 | 550 |

测试页面: `http://server:9098/test_db?db=cet4_test.db`

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript |
| 后端 | Express + better-sqlite3 |
| 前端 | React 19 + Vite 6 + Tailwind CSS 3 |
| 数据库 | SQLite |
| 容器 | Docker (node:20-alpine) |
| 端口 | 9098 |

## 目录结构

```
├── src/server/        # Express 后端
│   ├── index.ts       # 入口（当前为 mock 版）
│   └── models/        # 数据层
├── src/client/        # React 前端
│   └── src/pages/     # 页面组件
├── tests/             # 测试
│   ├── server/routes/ # API 集成测试（100 项）
│   └── db/            # Schema 验证测试
├── docker/            # Docker 引擎
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.test.yml
├── cli/               # 运行时管理脚本
│   ├── reset-password.js
│   ├── seed-test.js
│   ├── seed-bcw.js
│   └── seed-test-letters.js
├── data/              # 运行时数据（Docker 外）
├── config/            # JWT 密钥等
├── dist/client/       # 前端构建产物（volume 挂载）
├── docs/              # 设计文档
├── ref/               # CET-4 词汇表原始资料
└── start.sh           # 一键管理脚本
```

## 管理命令

```bash
bash start.sh                      # 构建并启动
bash start.sh --test               # 测试模式（50 词）
bash start.sh build                # 容器内构建前端
bash start.sh reset-password <用户名> [新密码]
bash start.sh fix-ownership        # 修复 data/config/logs 所有权
bash start.sh --help               # 查看帮助

# API 测试
docker exec docker-cet4-web-1 npx vitest run                    # 全部 100 项
docker exec docker-cet4-web-1 npx vitest run tests/server/routes/auth.test.ts  # 单文件

# Schema 验证
docker cp tests/db/schema_test.js docker-cet4-web-1:/app/tests/db/
docker exec docker-cet4-web-1 node tests/db/schema_test.js
```

## 测试

### API 集成测试（100 项）

使用 vitest + supertest 对全部 21 个 API 端点进行 HTTP 级集成测试，覆盖正常流程、参数验证、权限控制和边界情况。

| 模块 | 测试文件 | 用例数 |
|------|---------|--------|
| 认证 | `tests/server/routes/auth.test.ts` | 15 |
| 学习 | `tests/server/routes/learn.test.ts` | 31 |
| 进度 | `tests/server/routes/progress.test.ts` | 12 |
| 管理 | `tests/server/routes/admin.test.ts` | 25 |
| 公开 | `tests/server/routes/public.test.ts` | 5 |
| 设置 | `tests/server/routes/settings.test.ts` | 12 |

测试在内存数据库中运行，每次测试前重置数据，互不干扰。

### Schema 验证测试（111 项）

`tests/db/schema_test.js` 直接连接 SQLite 数据库，验证表结构、列定义、索引、外键和数据完整性。

## Docker 注意

- 基础镜像 `node:20-alpine` 需安装 `nodejs-dev` 包（提供 `libnode.so.109` 以支持 `better-sqlite3` 原生模块）
- 前端通过 volume 挂载 `../dist/client:/app/dist/client` 实现热更新
- 镜像拉取：当前环境无法直连 Docker Hub，使用华为云镜像 `swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine`

## 文件所有权

Docker 容器默认以 root 运行，在 volume 挂载路径创建的文件在宿主机上归属 `root:root`。

**解决策略**（已集成到 `start.sh`）：

1. **预防** — `docker run`/`exec` 均使用 `--user $(id -u):$(id -g)`，容器内进程直接以宿主机用户身份创建文件
2. **兜底** — `docker compose up` 后自动执行 `sudo chown`，清理 compose 启动阶段可能产生的 root 文件
3. **手动修复** — `bash start.sh fix-ownership` 随时可运行

> 若 `sudo chown` 因权限不足失败，提示中会给出手动执行的命令。

## 项目状态

当前为 **DEMO 阶段**，所有 API 返回 mock 数据。前端 UI 已完整展示 7 个页面和完整学习流程（新词模式选择 → 复习 → 新词 → 总测 → 通关结算）。真实后端代码已编写（database.ts、auth.ts、seed.ts）但未部署。
