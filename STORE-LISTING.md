# Chrome Web Store 上架材料

开发者后台各个字段直接复制这里的内容。**提交前请通读一遍**——审核被拒最常见的
原因就是权限说明写得含糊，或者说明与代码实际行为对不上。

---

## 基本信息

**Name**（最长 75 字符）

```
SSO Account Pin
```

**Short description**（最长 132 字符，会出现在搜索结果里）

```
Signed in to several Google accounts? Pin your company's SSO to the right one and sign in without the account chooser.
```

**Category**：Workflow & Planning
**Language**：English

---

## Detailed description

```
If you are signed in to more than one Google account in the same browser, corporate
single sign-on often picks the wrong one. You click an internal link, get bounced to
the account chooser, and have to pick your work account every time.

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
declarativeNetRequest API to add the hint at exactly that point.

SETUP

1. Open the options page
2. Enter your work email address
3. Enter your company's domains, one per line
4. Save, and grant access to those domains when prompted

Only requests whose URL contains one of your configured domains are modified.
Signing in with a personal account anywhere else is unaffected.

PRIVACY

No data is collected, and no data leaves your browser. There are no servers, no
analytics, and no tracking. Your settings are stored with Chrome's own storage API.
The extension never reads page content and never touches passwords or cookies.

WHAT IT DOES NOT DO

This extension selects an account. It does not bypass authentication. If your Google
session has expired, or your organization requires re-authentication, you will still
be asked for your password and second factor — that is by design and is not something
this extension circumvents.

Works with identity providers that federate to Google, including Keycloak.
```

---

## 权限说明（审核会逐条要求填写）

**Single purpose**

```
The extension has one purpose: to select a specific Google account during enterprise
single sign-on, by adding the standard login_hint parameter to sign-in requests for
domains the user configures.
```

**`declarativeNetRequest`**

```
Used to append the login_hint parameter to the OAuth authorization request generated
by the user's identity provider. This is the extension's core and only function.
Rules are evaluated by Chrome; the extension does not observe requests.
```

**`storage`**

```
Stores the user's settings: the email address to pin, the list of company domains,
and an optional account index. Local only; nothing is transmitted.
```

**Host permission — `accounts.google.com`**

```
The sign-in requests that need the login_hint parameter are served from this host.
This is the only host the extension requires at install time.
```

**Optional host permissions — `*://*/*`**

```
Chrome requires host access to a request's initiator for a redirect rule to apply.
The initiator is the user's own company domain, which the extension cannot know in
advance because it is configured by the user. The extension therefore declares this
as an OPTIONAL host permission and requests access only for the specific domains the
user enters on the options page. It is never requested for all sites.
```

**`declarativeNetRequestFeedback`（可选权限）**

```
Diagnostics only. Lets the options page show whether the user's own rules matched
recently, so misconfiguration can be identified. Declared as an optional permission,
requested only when the user clicks the diagnostics button, and revocable at any time.
```

---

## 上架前检查清单

- [ ] 用「加载已解压的扩展程序」实测通过：填配置 → 授权 → 登录 → 规则命中
- [ ] `manifest.json` 里 `version` 已递增（商店不接受重复版本号）
- [ ] 隐私政策已发布到一个公开可访问的 URL，并填进后台（`PRIVACY.md` 是内容源）
- [ ] 后台「数据使用」声明：勾选收集「个人身份信息 → 邮箱地址」，用途选「扩展的核心功能」，并勾选三项保证（不出售、不用于无关用途、不用于评估信用）
- [ ] 至少 1 张 1280×800 或 640×400 的截图（建议直接截设置页）
- [ ] 商店图标 128×128（`icons/icon128.png` 已就绪）
- [ ] 用 `tools/package.sh` 生成上传用的 zip

## 需要自己补的东西

以下几项与账号和发布方式绑定，代码里无法预置：

1. **开发者账号**：Chrome Web Store 开发者注册需一次性支付 5 美元
2. **隐私政策 URL**：把 `PRIVACY.md` 发到 GitHub Pages 或任意公开页面，拿到 URL
3. **支持邮箱**：后台要求填一个可联系的邮箱
4. **截图**：设置页填好配置后截一张即可

## 审核预期

这类扩展的风险点在于修改网络请求，审核通常会重点看两件事：**是否只改用户明确
配置的域名**，以及**权限是否可以更小**。当前设计对这两点都有交代——域名由用户
输入且规则条件里强制包含、诊断权限做成可选。首次提交一般需要几个工作日。
