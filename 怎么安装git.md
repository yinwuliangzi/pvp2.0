# Git 安装与使用

## 当前状态（2026-11-11 实测）

| 项 | 状态 |
|---|---|
| **Git 已安装** | ✅ `2.56.0.windows.4` |
| 安装位置 | `C:\Program Files\Git\cmd\git.exe` |
| 账号配置 | ✅ 已配置（yinwuliangzi / xu2008731@qq.com） |
| 中文不乱码 | ✅ 已设 `core.quotepath false` |
| **GitHub 连通性** | ❌ **当前连不上**（Connection reset） |
| Gitee | ✅ 正常 |

> **重要**：Git 装好了，但你这台机器现在**无法访问 GitHub**。
> 下面第五节有解决办法。

---

## 一、已经装好了，怎么用

### 必须新开终端

Git 是刚装的，**已经开着的窗口认不出 `git` 命令**。

1. 关掉所有 PowerShell / 终端
2. 按 `Win + X` → 选「终端」
3. 验证：

```powershell
git --version
```

应该显示：

```text
git version 2.56.0.windows.4
```

---

## 二、账号已经配好了

我检查过，你的机器上已经有：

```text
user.name  = yinwuliangzi
user.email = xu2008731@qq.com
```

还额外设了两条防乱码配置：

```powershell
git config --global core.quotepath false   # 中文文件名不乱码
git config --global core.autocrlf input    # 换行符统一
```

> 说明你之前装过 Git（后来卸了或换机器），配置文件留下来了。

---

## 三、如果以后要重装

### 方式一：winget（最简单，但可能卡）

```powershell
winget install --id Git.Git --source winget --accept-package-agreements --accept-source-agreements
```

> ⚠️ 实测：winget 下载 GitHub 的资源时**卡了 20 分钟没动静**。
> 因为 GitHub 连不上，原因见第五节。

### 方式二：国内镜像（推荐，实测 90 秒完成）

```powershell
$url = "https://registry.npmmirror.com/-/binary/git-for-windows/v2.56.0.windows.4/Git-2.56.0.4-64-bit.exe"
$out = "$env:TEMP\Git-installer.exe"
Invoke-WebRequest -Uri $url -OutFile $out

Start-Process -FilePath $out -ArgumentList "/VERYSILENT","/NORESTART","/SP-" -Wait
```

这次我就是用这个方法装的，**90 秒搞定**。

### 方式三：官网下载

<https://git-scm.com/download/win>

一路下一步即可，注意这几个选项：

- **默认编辑器** → 选 VSCode 或 Notepad++（不熟悉 vim 的话别选 vim）
- **PATH 环境** → 选默认的「Git from the command line and also from 3rd-party software」
- **换行符** → 选「Checkout as-is, commit Unix-style line endings」

---

## 四、GitHub 连不上怎么办

### 症状

```text
fatal: unable to access 'https://github.com/...':
Recv failure: Connection was reset
```

或者网页能开但 `git push` 一直卡住。

### 实测结果

```text
github.com                ❌ 失败
codeload.github.com       ❌ 失败
raw.githubusercontent.com ❌ 失败
gitee.com                 ✅ 正常
```

说明是**网络层拦截**，不是 Git 问题。

### 解决办法（三选一）

#### 方案 A：用 Gitee（国内，最稳）

注册 <https://gitee.com>，新建仓库，然后：

```powershell
git remote set-url origin https://gitee.com/你的用户名/pvp.git
git push -u origin main
```

Gitee 也有 Pages 功能（仓库设置 → 服务 → Gitee Pages），免费版需要手动点发布。

**缺点**：得重新注册，Pages 域名是 `用户名.gitee.io`。

#### 方案 B：走代理（如果你有梯子）

先确认代理端口，然后：

```powershell
# 假设代理在 7890
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

取消代理：

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

> 我检测过你机器上常见的几个端口（7890 / 10809 / 1080 / 8080 / 7897），**都没有代理在跑**。

#### 方案 C：继续用网页拖拽

GitHub 网页有时能开（走的是不同线路）。继续用之前给你做的精简包：

```text
上传用-喵喵洛克PVP助手.zip  （55 个文件 / 5.39MB）
一次拖完，不需要分批
```

**这是目前最现实的方式。**

---

## 五、等网络恢复后，怎么用 Git 推

### 第一次（把网站推上去）

```powershell
cd "你的网站文件夹"

git init
git add .
git commit -m "初始上传"
git branch -M main
git remote add origin https://github.com/yinwuliangzi/pvp.git
git push -u origin main
```

会弹浏览器让你登录 GitHub，点授权即可。

### 以后更新

```powershell
git add .
git commit -m "改了啥"
git push
```

### 常用命令

| 想看什么 | 命令 |
|---|---|
| 改了哪些文件 | `git status` |
| 具体改了什么 | `git diff` |
| 提交历史 | `git log --oneline` |
| 撤销未提交的改动 | `git checkout -- 文件名` |
| 撤销上次提交（保留改动） | `git reset --soft HEAD~1` |

---

## 六、常见问题

### git 命令找不到

**没重开终端**。关掉窗口开个新的。

检查 PATH：

```powershell
$env:Path -split ';' | Select-String Git
```

应看到 `C:\Program Files\Git\cmd`。

### push 一直要密码

GitHub 不支持密码了。第一次 push 选**浏览器登录**最省事。

如果要 Token：GitHub → Settings → Developer settings → Personal access tokens → 生成，勾选 `repo` 权限。

### fatal: not a git repository

不在仓库目录里，先 `cd` 过去。

### 中文文件名显示成 \344\275\240

```powershell
git config --global core.quotepath false
```

（已经帮你设好了）

### 想卸载

```powershell
winget uninstall Git.Git
```

或控制面板 → 程序和功能 → Git → 卸载。

---

## 七、不想碰命令行？

装 **GitHub Desktop**：<https://desktop.github.com/>

图形界面点点点，功能一样。但同样需要能连 GitHub。

---

## 八、总结：你现在的情况

```text
✅ Git 已装好（2.56.0）
✅ 账号已配置
✅ 中文不乱码已设
❌ GitHub 连不上（网络问题，非工具问题）

→ 现在：用网页拖拽（精简包已备好）
→ 等网络好了：直接 git push
→ 或者：换 Gitee
```
