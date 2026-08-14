// 设置的读写与规范化。设置页和后台都用这一份，避免两边对"什么是合法配置"
// 理解不一致。

export const DEFAULTS = {
  email: "", // 要锁定的企业 Google 账号
  domains: [], // 企业域名，用来识别"这是公司的 SSO 流程"
  useAuthuser: false, // 是否额外挂 authuser（会话索引）
  authuser: "", // 会话索引，Gmail 地址栏 /mail/u/N/ 里的 N
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
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

export function isComplete(settings) {
  return Boolean(settings.email && settings.domains.length);
}

// ── 备份 ─────────────────────────────────────────────────────────────────
// format 字段是为了把别的 JSON 挡在外面：没有它，随手选错一个文件也会被
// 当成配置读进来，最后生成一堆莫名其妙的规则。

export const EXPORT_FORMAT = "sso-account-pin/settings";
export const EXPORT_VERSION = 1;

export function serializeSettings(settings) {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      email: settings.email,
      domains: settings.domains,
      useAuthuser: settings.useAuthuser,
      authuser: settings.authuser,
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
    throw new Error("不是合法的 JSON");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("文件内容不是配置对象");
  }
  if (raw.format !== EXPORT_FORMAT) {
    throw new Error("不是本扩展导出的配置文件");
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
  };

  if (!isComplete(settings)) {
    throw new Error("文件里缺邮箱或企业域名");
  }
  return settings;
}
