# Chrome Web Store 上架材料

开发者后台各字段直接复制这里的内容。**提交前请通读一遍**——审核被拒最常见的原因
就是权限说明写得含糊，或者说明与代码实际行为对不上。

发布配置：**公开（Public）** · 默认语言 **English** · 另附中文（简体）翻译。
扩展本身是中英双语（`_locales/`），Chrome 按用户语言自动切换。

---

# 一、Store listing（English，默认语言）

**Name**（最长 75 字符）

```
SSO Account Pin
```

**Short description**（最长 132 字符，出现在搜索结果里）

```
Signed in to several Google accounts? Pin your company's SSO to the right one and sign in without the account chooser.
```

**Category**：Workflow & Planning　**Language**：English

**Detailed description**

```
If you are signed in to more than one Google account in the same browser, corporate
single sign-on often picks the wrong one. You click an internal link, get bounced to
the account chooser, and have to pick your work account every single time.

SSO Account Pin fixes that. It adds the standard OpenID Connect `login_hint`
parameter to your organization's sign-in requests, so Google selects the right
account directly.

When your work account already has an active Google session, sign-in completes
silently: no account chooser, no email prompt, no password. You click an internal
link and you are in.

HOW IT WORKS

Your identity provider redirects to Google's authorization endpoint as part of the
sign-in flow. That redirect happens on the network, before any page is rendered,
which is why a page-level script cannot reach it. This extension uses Chrome's
declarativeNetRequest API to add the hint at exactly that point. Chrome evaluates
the rules itself — the extension never watches your traffic.

SETUP

1. Open the options page
2. Enter your work email address
3. Enter your company's domains, one per line
4. Save, and grant access to those domains when prompted

YOU CONTROL THE SCOPE

The extension asks for access only to the domains you type in. It does not request
access to all sites, and it cannot modify a request unless that request's URL
contains one of your configured domains. Signing in with a personal account anywhere
else is completely unaffected.

Your settings can be exported to a JSON file and imported again, so reinstalling or
moving to a new machine does not mean retyping everything.

PRIVACY

No servers, no analytics, no tracking, and nothing sold or shared. The extension
never reads page content, never injects scripts, and never touches passwords or
cookies. Your settings are stored with Chrome's own storage API.

WHAT IT DOES NOT DO

This extension selects an account. It does not bypass authentication. If your Google
session has expired, or your organization requires re-authentication, you will still
be asked for your password and second factor — that is by design and is not something
this extension circumvents.

Works with identity providers that federate to Google, including Keycloak.

Available in English and Simplified Chinese.
```

---

# 二、Store listing（中文（简体）翻译）

在 Store listing 页面顶部的语言下拉里加一项 **中文（简体）**，填以下内容。

**Name**

```
SSO 账号锁定
```

**Short description**

```
浏览器里登录了多个 Google 账号？把公司 SSO 锁定到指定账号，登录时不再弹出选账号页面。
```

**Detailed description**

```
在同一个浏览器里登录了多个 Google 账号时，企业单点登录经常认到错误的那一个。点一下
内部链接，就被甩到「选择账号」页面，每次都要重新挑一遍工作账号。

SSO 账号锁定解决的就是这个问题。它给公司的登录请求加上标准的 OpenID Connect
`login_hint` 参数，让 Google 直接选中正确的账号。

当工作账号的 Google 会话还有效时，整个登录是静默的：不选账号、不输邮箱、不输密码，
点链接直接进系统。

工作原理

登录过程中，企业身份提供方会重定向到 Google 的授权端点。这一跳发生在网络层，页面
根本不会渲染，所以页面级脚本够不着它。本扩展使用 Chrome 的 declarativeNetRequest
接口，正好在这个位置补上参数。规则由 Chrome 自己执行，扩展不会监视你的流量。

使用方法

1. 打开设置页
2. 填入你的企业邮箱
3. 填入公司域名，一行一个
4. 保存，并在提示时授权这些域名

范围完全由你决定

扩展只会申请你填入的那些域名的访问权限，不会申请「所有网站」，也无法改写 URL 里不
含这些域名的任何请求。你用个人账号登录其他网站完全不受影响。

配置可以导出成 JSON 文件再导入，重装扩展或换机器时不用重新填一遍。

隐私

没有服务器，没有统计，没有追踪，不出售也不共享任何数据。扩展不读取网页内容、不注入
脚本、不接触密码和 Cookie。设置保存在 Chrome 自带的存储接口里。

它不做什么

这个扩展只负责选账号，不绕过认证。如果 Google 会话已过期，或者你所在组织要求重新
认证，仍然会要求输入密码和两步验证——这是有意为之，扩展不会去绕过它。

适用于联合到 Google 的身份提供方，包括 Keycloak。

支持简体中文和英文界面。
```

---

# 三、Privacy practices 标签页

审核逐条看这里。全部用英文填。

**Single purpose**

```
The extension has one purpose: to select a specific Google account during enterprise
single sign-on, by adding the standard login_hint parameter to sign-in requests for
domains the user configures.
```

后台「需请求权限的理由」是四个输入框，每框上限 1000 字符。注意**主机权限只有一个
框**——必需的 `accounts.google.com` 和可选的 `*://*/*` 要合并写在一起。

页面顶部关于「涉及主机权限需深入审核、发布时间延迟」的黄色警告是预期内的，
`*://*/*` 必然触发，这也是主机权限那段要写得格外具体的原因。

**需请求 declarativeNetRequest 的理由**（795 字符）

```
This is the extension's core and only function. When the user's identity provider redirects to Google's OAuth authorization endpoint, the extension appends the standard OpenID Connect "login_hint" parameter (and optionally "authuser") to that request, so Google selects the work account the user configured instead of showing an account chooser.

That redirect happens on the network before any page is rendered, so a content script cannot reach it. declarativeNetRequest is the only API that can modify the request at that point.

Rules are generated dynamically from the domains the user enters on the options page, and every rule condition requires one of those domains to appear in the URL. Chrome evaluates the rules itself: the extension does not observe, log, or receive any request data.
```

**需请求 storage 的理由**（454 字符）

```
Stores the user's own settings so they persist across browser sessions: the work email address to pin, the list of company domains that identify the organization's sign-in flow, and an optional account index ("authuser").

These values are needed to rebuild the redirect rules on startup and whenever the user changes them. Nothing else is stored. The extension transmits nothing: it has no server, no analytics, and makes no network requests of its own.
```

**需请求 declarativeNetRequestFeedback 的理由**（760 字符）

```
Diagnostics only. This is declared as an OPTIONAL permission and is not requested at install time.

The enterprise sign-in flow is a chain of server-side 302 redirects, so a user with a wrong configuration cannot tell whether the rules matched. The options page therefore offers a "Show recent rule matches" button. Only when the user clicks it does the extension call permissions.request(), and then chrome.declarativeNetRequest.getMatchedRules() to list which of THIS EXTENSION'S OWN rules matched in the last 5 minutes. Only a timestamp and a rule ID are shown.

No browsing history is read or stored, nothing is transmitted, and the user can revoke the permission at any time from the extension's details page. The extension is fully functional without it.
```

**需请求主机权限的理由**（869 字符，必需 + 可选合并）

```
Required, "*://accounts.google.com/*": the OAuth authorization request that needs the login_hint parameter is served from this host. It is the only host the extension requires at install time.

Optional, "*://*/*": Chrome requires host access to a redirect rule's INITIATOR for that rule to apply. The initiator is the user's own company domain, which the extension cannot know in advance because the user types it on the options page. A fixed list is therefore impossible.

This pattern is declared under "optional_host_permissions", never under "host_permissions". The extension never requests access to all sites. When the user saves settings, it calls permissions.request() with only the specific origins derived from the domains that user entered (see domainsToOrigins() in settings.js). The extension installs and runs correctly with no broad host access granted.
```

> 这几段用英文填，与 listing 的语言无关——审核团队以英文工作。主机权限那段特意点了
> `optional_host_permissions` 和 `domainsToOrigins()`，审核员会去代码里核对，直接
> 给出位置能省一轮问询。

**您正在使用远程代码吗？**：选 **不，我并未使用远程代码**

> 后台这一项默认可能选中"是的"，务必改掉。本扩展所有代码都在包里，没有 CDN 引用、
> 没有 `eval()`、没有外部 `<script>`，连行内标记渲染都刻意避开了 `innerHTML`。

**Data usage** — 勾选与声明

| 项 | 怎么填 |
|---|---|
| 收集的数据类别 | 只勾 **Personally identifiable information**（用户填的企业邮箱） |
| 其余类别 | 全部不勾（不涉及密码、位置、浏览记录、网页内容等） |
| 用途 | 选 **App functionality / 扩展的核心功能** |
| 三项保证 | 三个全部勾选：不出售或转移给第三方、不用于与单一用途无关的目的、不用于判定信用 |

> 为什么明明"不上传"还要勾 PII：设置存在 `chrome.storage.sync` 里，开了 Chrome
> Sync 的话数据确实会离开设备（由 Chrome 同步，不是扩展）。按 CWS 的口径这算
> collect。`PRIVACY.md` 已按同一口径写，两边对得上，别改成"完全不收集"。

**Privacy policy URL**：见下面第四节

---

# 四、隐私政策（GitHub Gist）

1. 打开 <https://gist.github.com>
2. 文件名填 `sso-account-pin-privacy.md`
3. 内容粘贴 `PRIVACY.md` 全文
4. 点 **Create public gist**（必须 public，Secret gist 审核打不开）
5. 复制地址栏 URL，填进后台 Privacy practices 的 Privacy policy URL

> 之后改隐私政策记得同步更新 gist——审核会实际访问这个链接。

---

# 五、提交流程

1. `./tools/package.sh` → 得到 `dist/sso-account-pin-1.0.0.zip`
2. 后台 → **Add new item** → 上传 zip
3. 填 **Store listing**（第一节），保存
4. 语言下拉切到 **中文（简体）**，填第二节，保存
5. 填 **Privacy practices**（第三节）+ gist URL，保存
6. **Distribution**：Visibility = **Public**，地区全选，免费
7. 右上角 **Submit for review**

首次提交通常几个工作日，赶上人工复审可能一两周。之后每次更新都要**递增
`manifest.json` 的 `version`**，商店不接受重复版本号。

---

# 六、上架前检查清单

- [ ] 用「加载已解压的扩展程序」实测通过：填配置 → 授权 → 登录 → 规则命中
- [ ] 中英两种界面都看过（`chrome://settings/languages` 切换后重启浏览器）
- [ ] `manifest.json` 里 `version` 已递增
- [ ] 隐私政策 gist 已 public 发布，URL 已填进后台
- [ ] 数据使用声明按上表勾选完毕
- [ ] 至少 1 张 1280×800 或 640×400 的截图（建议直接截设置页）
- [ ] 支持邮箱已在开发者账号设置里**验证过**（没验证的邮箱填不进去）
- [ ] 用 `tools/package.sh` 生成 zip，确认 `_locales/` 在包里

## 审核预期

风险点在于修改网络请求，审核通常重点看两件事：**是否只改用户明确配置的域名**，
以及**权限是否可以更小**。当前设计对这两点都有交代——域名由用户输入且规则条件里
强制包含、宽泛 host 权限做成可选按需申请、诊断权限同样可选。

如果收到质询，最可能是关于 `optional_host_permissions: *://*/*`。回复要点：它是
optional 而非必需，扩展在未获得任何宽泛授权时功能完整，实际只对用户输入的域名调用
`permissions.request()`，代码见 `options.js` 的 `domainsToOrigins()`。
