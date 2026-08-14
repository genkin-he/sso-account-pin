import { getSettings, isComplete } from "./settings.js";

const PREFIX = "[SSO Account Pin]";

// ── 规则生成 ───────────────────────────────────────────────────────────────
// 规则在运行时按用户配置生成（动态规则），而不是写死在 rules.json 里，
// 这样每个人填自己的邮箱和域名即可，代码里不含任何具体组织的信息。

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 域名匹配必须卡住边界，不能用裸子串。否则 evil-yourcompany.com.attacker.io
// 这种域名也会命中，扩展就会把用户邮箱当作 login_hint 挂到第三方的 OAuth
// 请求上——等于主动泄露邮箱。
//
// 域名前面只允许这几种字符，等价于"这里是一个主机名的开头"：
//   %2F%2F    redirect_uri 里编码过的 "//"，其后就是主机名
//   ?hd= &hd= Google 的 hosted domain 参数
//   ,         hd= 是逗号分隔的列表，本公司域名未必排第一
//   .         子域分隔符，让 app.yourcompany.com 也能命中
// 用单字符类而不是 ([a-z0-9-]+\.)* 这种嵌套量词，是因为后者编译代价太高，
// 域名一多就会撞上 Chrome 对 regexFilter 的 2KB 编译上限。
const PREFIX_BOUNDARY = "(%2F%2F|[?&]hd=|,|\\.)";

// 域名后面必须是分隔符，堵住 yourcompany.com.attacker.io
const SUFFIX_BOUNDARY = "([%,&/]|$)";

// Keycloak 的授权/代理端点。这两条用 urlFilter 而不是正则：urlFilter 的 ||
// 本身就按域名边界匹配、自动覆盖子域，既精确又不占正则预算。
const IDP_PATHS = [
  "/realms/*/protocol/openid-connect/auth",
  "/realms/*/broker/*/login",
];

function buildRules(settings) {
  const addOrReplaceParams = [{ key: "login_hint", value: settings.email }];
  if (settings.useAuthuser && settings.authuser !== "") {
    addOrReplaceParams.push({ key: "authuser", value: String(settings.authuser) });
  }

  const action = {
    type: "redirect",
    redirect: { transform: { queryTransform: { addOrReplaceParams } } },
  };

  // 每个域名单独出规则，不把所有域名拼成一个大正则——
  // 拼起来会超出 2KB 编译上限，整条规则被 Chrome 静默跳过。
  const rules = [];
  let id = 1;

  for (const domain of settings.domains) {
    // Google 的 OAuth 授权端点——身份提供方 302 过去的那一跳，真正的注入点
    rules.push({
      id: id++,
      priority: 1,
      action,
      condition: {
        regexFilter:
          `^https://accounts\\.google\\.com/o/oauth2/(v2/)?auth\\?.*` +
          `${PREFIX_BOUNDARY}${escapeForRegex(domain)}${SUFFIX_BOUNDARY}`,
        resourceTypes: ["main_frame"],
      },
    });

    // 企业侧 IdP。是否把 login_hint 透传给上游 Google 取决于服务端配置，
    // 透传了这些才有用，没透传也不影响上面那条。
    for (const path of IDP_PATHS) {
      rules.push({
        id: id++,
        priority: 1,
        action,
        condition: { urlFilter: `||${domain}${path}`, resourceTypes: ["main_frame"] },
      });
    }
  }

  return rules;
}

async function rebuildRules() {
  const settings = await getSettings();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);

  if (!isComplete(settings)) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    console.log(`${PREFIX} 配置不完整（缺邮箱或域名），已清空规则`);
    return;
  }

  const wanted = buildRules(settings);
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: wanted,
    });
  } catch (err) {
    // 域名含特殊字符导致正则非法之类，要让用户在设置页看得到
    console.error(`${PREFIX} 规则写入失败：`, err);
    return;
  }

  // Chrome 遇到单条非法规则时会跳过它、继续写入其余的，只在控制台留一行日志。
  // 不主动核对的话，用户会以为全部生效了，实际少了几条。
  const actual = await chrome.declarativeNetRequest.getDynamicRules();
  if (actual.length !== wanted.length) {
    const written = new Set(actual.map((rule) => rule.id));
    const skipped = wanted.filter((rule) => !written.has(rule.id));
    console.error(
      `${PREFIX} 有 ${skipped.length}/${wanted.length} 条规则被跳过：`,
      skipped
    );
    return;
  }

  console.log(`${PREFIX} ${actual.length} 条规则已生效 → ${settings.email}`);
}

chrome.runtime.onInstalled.addListener(rebuildRules);
chrome.runtime.onStartup.addListener(rebuildRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") rebuildRules();
});

// 点扩展图标直接开设置页
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// 规则命中日志。onRuleMatchedDebug 只在「加载已解压的扩展程序」时可用，
// 商店安装的版本不会触发——那种情况下用设置页里的「最近命中」查看。
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log(`${PREFIX} 规则 ${info.rule.ruleId} 命中 →`, info.request.url);
  });
}

rebuildRules();
