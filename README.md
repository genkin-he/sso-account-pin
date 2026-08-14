# SSO Account Pin

Chrome 扩展。浏览器里同时登录了多个 Google 账号时，企业 SSO 常常认到错误的账号、
把你甩到「选账号 / 输邮箱」页面。这个扩展在**网络请求层**给企业 SSO 的授权请求挂上
`login_hint=<你的企业邮箱>`，让 Google 直接选中指定账号。

配置全部在设置页里填，代码中不含任何具体组织或个人的信息。

## 为什么要在网络请求层注入

登录链路是这样的：

```
应用 → 企业 IdP → (302) → accounts.google.com/o/oauth2/auth → (302) → 登录界面
                            ↑
                     真正该注入的位置
```

`login_hint` 是 OAuth **授权请求**的参数，只在 `/o/oauth2/auth` 那一跳有意义。
而那一跳是服务端 302，浏览器不渲染页面，页面级脚本没有任何执行机会——最早也只能在
最后的登录界面上运行，那时授权请求早已处理完毕，再追加参数 Google 直接忽略。

`declarativeNetRequest` 工作在请求发出之前，正好卡在这个位置。

## 安装（开发模式）

1. `chrome://extensions/` → 打开右上角「开发者模式」
2. 「加载已解压的扩展程序」→ 选中本目录
3. 点扩展图标打开设置页

## 配置

| 项 | 说明 |
|---|---|
| **企业 Google 账号** | 必填。会作为 `login_hint` 挂到授权请求上 |
| **企业域名** | 必填。一行一个，用来识别「这是公司的登录流程」 |
| **会话索引 `authuser`** | 可选。仅在只挂 `login_hint` 选不中账号时才需要 |

保存时会申请这些域名的访问权限。扩展安装时只要 `accounts.google.com` 的权限，
企业域名走可选权限，你填了哪些就只申请哪些。

**域名这项决定了影响范围**：只有 URL 里出现这些域名的请求才会被改写。用个人账号
登录其他网站完全不受影响。填得越精确越安全。

`authuser` 的取值是 Gmail 地址栏 `/mail/u/N/` 里的那个 N。它会随登录顺序变化，
所以默认不启用——`login_hint` 是标准参数，更稳。

保存后设置页底部会显示实际生效的规则，可以直接核对。

## 备份配置

设置页的「备份配置」可以把当前配置导出成 JSON 文件，重装扩展或换机器后导入回来。
导入只会填进表单，**还要点一次「保存并授权」才生效**——因为域名变了得重新申请
host 权限，而权限申请必须由点击直接触发。

文件里含你的企业邮箱和域名列表，别随手外发。

> 开发模式下点「重新加载」🔄 不会清掉配置。配置消失通常是「移除」后重新添加，
> 或者换了加载目录——未打包扩展的 ID 由目录路径推导，换目录等于换了个扩展。

## 验证是否生效

走一次公司登录，看地址栏最终停留的 URL 里有没有 `login_hint=<你的邮箱>`。

或者用设置页的「诊断」：点「查看最近命中的规则」，会列出最近 5 分钟内的命中记录。
这需要额外授权一项权限，仅用于读取本扩展自己的命中记录，随时可撤销。

## 效果与限制

**企业账号的 Google 会话有效时，整个登录是静默的**——不选账号、不输邮箱、不输密码，
点链接直接进系统。因为 `login_hint` 让 Google 直接命中那个已有会话，无需任何交互。

**会话失效时会退回正常登录**：Google 会认对账号（页面显示 "Welcome your@company.com"），
但要求输密码，可能还有两步验证。这是正常且正确的行为——扩展只负责选对账号，
不碰认证本身。密码交给密码管理器。

**如果企业 IdP 配置了强制重新认证**（授权请求里带 `prompt=login` 或 `max_age=0`），
那么每次都会要密码。这是组织有意设置的安全策略，扩展不会去绕过它，你也不该绕。

**规则 2 依赖服务端配置。** 企业 IdP 是否把 `login_hint` 透传给上游 Google，
取决于 IdP 里的「Pass login_hint」开关，通常在 IT 手上。没开的话规则 2 无效，
但规则 1 直接改 Google 的请求，不受影响。

**规则 2 目前只适配 Keycloak 形态的 IdP**，匹配 `/realms/*/protocol/openid-connect/auth`
和 `/realms/*/broker/*/login`。用 Okta / Azure AD 的话规则 2 不命中，规则 1 依然有效。

**不会死循环。** 参数值不变时 transform 产出的 URL 与请求 URL 相同，Chrome 会忽略
这次重定向。

## 排查

规则没命中时，先用设置页的「诊断」确认——有命中记录说明规则本身没问题。

若要看每一跳的**真实 URL**（企业 SSO 全是 302，地址栏和页面控制台都看不到），
可以临时在本地加回请求日志：`manifest.json` 的 `permissions` 加 `"webRequest"`，
`background.js` 里挂 `chrome.webRequest.onBeforeRequest` 打印 `details.url`。
**这只用于本地排查，不要带进上架的包**——`webRequest` 会触发「读取浏览记录」
权限警告，是审核的重点关注项。

规则写入失败（比如域名含特殊字符导致正则非法）会在 Service Worker 控制台里以
`规则写入失败` 报出来。打开方式：`chrome://extensions/` → 本扩展 →「Service Worker」。

## 发布到 Chrome Web Store

上架材料见 [STORE-LISTING.md](STORE-LISTING.md)，隐私政策见 [PRIVACY.md](PRIVACY.md)。

打包：

```bash
./tools/package.sh
```

产物在 `dist/`，只含扩展运行所需文件，`tools/` 和文档不会打进去。

## 文件

| 文件 | 作用 |
|---|---|
| `manifest.json` | MV3 清单。静态权限只有 `accounts.google.com` |
| `settings.js` | 设置读写与域名清洗，后台和设置页共用 |
| `background.js` | 按配置生成动态规则 |
| `options.html/css/js` | 设置页与诊断 |
| `icons/` | 图标，由 `tools/make-icons.py` 生成 |
| `tools/make-icons.py` | 纯标准库手写 PNG 编码，不依赖 PIL |
| `tools/package.sh` | 生成上传用 zip |
