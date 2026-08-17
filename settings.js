// 设置的读写与规范化。设置页和后台都用这一份，避免两边对"什么是合法配置"
// 理解不一致。

export const DEFAULTS = {
  email: "", // 要锁定的企业 Google 账号
  domains: [], // 企业域名，用来识别"这是公司的 SSO 流程"
  useAuthuser: false, // 是否额外挂 authuser（会话索引）
  authuser: "", // 会话索引，Gmail 地址栏 /mail/u/N/ 里的 N
  // 账号绑定：[{ email, domains: [] }]，给指定域名挂 authuser=<email>。
  // 和上面的 SSO 规则是两回事——那个改的是 OAuth 授权请求，这个改的是
  // Google 服务本身的多账号会话选择（Meet / Docs / Calendar 这类）。
  accountRules: [],
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  // storage 里可能是旧版本存的、或者手工导入过的，统一过一遍规范化
  settings.accountRules = normalizeAccountRules(settings.accountRules);
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

// 用户可能粘进来 https://xxx.com/path 或者用逗号、空格、换行随便分隔，
// 统一清洗成裸域名数组。
export function parseDomains(text) {
  return [
    ...new Set(
      String(text)
        .split(/[\s,;]+/)
        .map((item) => item.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
        .filter((item) => item.includes("."))
        .map((item) => item.toLowerCase())
    ),
  ];
}

// 域名转成 host 权限模式，用于申请可选权限
export function domainsToOrigins(domains) {
  return domains.flatMap((domain) => [`*://${domain}/*`, `*://*.${domain}/*`]);
}

// 一组账号绑定要有邮箱、也要有域名，缺一不可——只填一半生成不出规则，
// 留着只会让"当前生效的规则"和用户预期对不上。
export function normalizeAccountRules(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => ({
      email: typeof group?.email === "string" ? group.email.trim() : "",
      domains: parseDomains(
        Array.isArray(group?.domains) ? group.domains.join("\n") : group?.domains ?? ""
      ),
    }))
    .filter((group) => group.email && group.domains.length);
}

// SSO 那一半是否可用
export function isComplete(settings) {
  return Boolean(settings.email && settings.domains.length);
}

// 两块功能各自独立，配了任意一块就该生成规则。
// 只用账号绑定、完全不配 SSO 也是合法用法。
export function hasAnyConfig(settings) {
  return isComplete(settings) || settings.accountRules.length > 0;
}

// 邮箱和域名只填了一个——多半是填了一半忘了另一半，值得提示
export function isSsoPartial(settings) {
  return Boolean(settings.email) !== settings.domains.length > 0;
}

// 两块配置涉及的所有域名，去重后转成 host 权限模式
export function allOrigins(settings) {
  const domains = new Set(settings.domains);
  for (const group of settings.accountRules) {
    for (const domain of group.domains) domains.add(domain);
  }
  return domainsToOrigins([...domains]);
}

// ── 备份 ─────────────────────────────────────────────────────────────────
// format 字段是为了把别的 JSON 挡在外面：没有它，随手选错一个文件也会被
// 当成配置读进来，最后生成一堆莫名其妙的规则。

export const EXPORT_FORMAT = "sso-account-pin/settings";
// v2 起多了 accountRules。v1 的文件照样能导入——缺这个字段就是空数组。
export const EXPORT_VERSION = 2;

// 抛的是 _locales 的消息键，不是成品文案——这个模块后台也在用，不该关心
// 界面语言。调用方拿到 err.message 后自己去 chrome.i18n 取词。
export const IMPORT_ERRORS = {
  NOT_JSON: "importErrNotJson",
  NOT_OBJECT: "importErrNotObject",
  WRONG_FORMAT: "importErrWrongFormat",
  MISSING_FIELDS: "importErrMissingFields",
};

export function serializeSettings(settings) {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      email: settings.email,
      domains: settings.domains,
      useAuthuser: settings.useAuthuser,
      authuser: settings.authuser,
      accountRules: settings.accountRules,
    },
    null,
    2
  );
}

// 导入的文件是外部输入，逐字段校验后再规范化——文件可能是手改过的，
// 也可能是旧版本导出的。宁可在这里报错，也不要把半截配置写进 storage。
export function parseSettingsFile(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(IMPORT_ERRORS.NOT_JSON);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(IMPORT_ERRORS.NOT_OBJECT);
  }
  if (raw.format !== EXPORT_FORMAT) {
    throw new Error(IMPORT_ERRORS.WRONG_FORMAT);
  }

  const settings = {
    email: typeof raw.email === "string" ? raw.email.trim() : "",
    // 数组和纯文本都收，都过一遍 parseDomains 走同一套清洗逻辑
    domains: parseDomains(
      Array.isArray(raw.domains) ? raw.domains.join("\n") : raw.domains ?? ""
    ),
    useAuthuser: raw.useAuthuser === true,
    authuser:
      typeof raw.authuser === "string" || typeof raw.authuser === "number"
        ? String(raw.authuser).trim()
        : "",
    // v1 的文件没有这个字段，normalize 会给出空数组
    accountRules: normalizeAccountRules(raw.accountRules),
  };

  // 只有账号绑定、不配 SSO 也是完整配置
  if (!hasAnyConfig(settings)) {
    throw new Error(IMPORT_ERRORS.MISSING_FIELDS);
  }
  return settings;
}
