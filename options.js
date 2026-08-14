import {
  getSettings,
  saveSettings,
  parseDomains,
  domainsToOrigins,
  isComplete,
  serializeSettings,
  parseSettingsFile,
} from "./settings.js";

const form = document.getElementById("settings-form");
const emailInput = document.getElementById("email");
const domainsInput = document.getElementById("domains");
const useAuthuserInput = document.getElementById("use-authuser");
const authuserInput = document.getElementById("authuser");
const statusEl = document.getElementById("status");
const rulesSection = document.getElementById("active-rules");
const rulesDump = document.getElementById("rules-dump");
const checkMatchesButton = document.getElementById("check-matches");
const diagStatus = document.getElementById("diag-status");
const matchedDump = document.getElementById("matched-dump");
const exportButton = document.getElementById("export-config");
const importButton = document.getElementById("import-config");
const importFile = document.getElementById("import-file");
const backupStatus = document.getElementById("backup-status");

const EXPORT_FILENAME = "sso-account-pin-config.json";

function setStatus(element, message, kind) {
  element.textContent = message;
  element.className = kind || "";
}

function syncAuthuserEnabled() {
  authuserInput.disabled = !useAuthuserInput.checked;
}

function fillForm(settings) {
  emailInput.value = settings.email;
  domainsInput.value = settings.domains.join("\n");
  useAuthuserInput.checked = settings.useAuthuser;
  authuserInput.value = settings.authuser;
  syncAuthuserEnabled();
}

function readForm() {
  return {
    email: emailInput.value.trim(),
    domains: parseDomains(domainsInput.value),
    useAuthuser: useAuthuserInput.checked,
    authuser: authuserInput.value.trim(),
  };
}

async function load() {
  fillForm(await getSettings());
  await showActiveRules();
}

// 把后台实际写进去的规则显示出来。用户不用猜"到底保存成功没有"，
// 排查规则为什么没命中时也能直接对照。
async function showActiveRules() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (!rules.length) {
    rulesSection.hidden = true;
    return;
  }
  rulesSection.hidden = false;
  const params = rules[0].action.redirect.transform.queryTransform.addOrReplaceParams
    .map((param) => `${param.key}=${param.value}`)
    .join("  ");
  // 规则按域名逐条生成，数量可能几十条，全展开太长；
  // 只列匹配条件，参数所有规则都一样，抽出来说一次即可。
  const lines = rules.map((rule) => {
    const matcher = rule.condition.regexFilter || rule.condition.urlFilter;
    return `  ${String(rule.id).padStart(2)}  ${matcher}`;
  });
  rulesDump.textContent =
    `共 ${rules.length} 条，命中后一律挂上：${params}\n\n` + lines.join("\n");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = readForm();

  if (!isComplete(settings)) {
    setStatus(statusEl, "邮箱和至少一个企业域名都要填", "err");
    return;
  }

  // 域名是用户填的，对应的 host 权限只能在这里按需申请——
  // 必须由点击这类用户手势触发，不能在后台静默调用。
  let granted = false;
  try {
    granted = await chrome.permissions.request({
      origins: domainsToOrigins(settings.domains),
    });
  } catch (err) {
    setStatus(statusEl, `权限申请失败：${err.message}`, "err");
    return;
  }

  if (!granted) {
    setStatus(statusEl, "没有授权这些域名，规则无法生效", "err");
    return;
  }

  await saveSettings(settings);
  // 后台监听 storage 变化后重建规则，稍等一下再读取展示
  setTimeout(showActiveRules, 300);

  domainsInput.value = settings.domains.join("\n");
  setStatus(statusEl, `已保存，锁定到 ${settings.email}`, "ok");
});

useAuthuserInput.addEventListener("change", syncAuthuserEnabled);

// ── 备份 ─────────────────────────────────────────────────────────────────
// 走 Blob + <a download>，不用 downloads 权限——那个权限会多一条授权提示，
// 为了导出一个几百字节的文件不值得。

exportButton.addEventListener("click", () => {
  // 导出表单里的内容而不是已保存的配置：两者在正常情况下一致，
  // 不一致时用户看到什么就该导出什么。
  const settings = readForm();
  if (!isComplete(settings)) {
    setStatus(backupStatus, "配置不完整，先填邮箱和企业域名", "err");
    return;
  }

  const blob = new Blob([serializeSettings(settings)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = EXPORT_FILENAME;
  link.click();
  // 立刻 revoke 有可能赶在下载真正开始之前，让出一轮事件循环再回收
  setTimeout(() => URL.revokeObjectURL(url), 0);

  setStatus(backupStatus, `已导出 ${EXPORT_FILENAME}`, "ok");
});

importButton.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;

  try {
    fillForm(parseSettingsFile(await file.text()));
    // 只填表，不落库。域名变了就得重新申请 host 权限，而权限申请必须由
    // 用户手势直接触发——读文件是异步的，手势早过期了。让用户走一遍
    // 「保存并授权」，顺带也给了个反悔的机会。
    setStatus(backupStatus, "已载入，点上面的「保存并授权」生效", "ok");
  } catch (err) {
    setStatus(backupStatus, `导入失败：${err.message}`, "err");
  } finally {
    // 不清空的话，连续导入同一个文件不会再触发 change
    importFile.value = "";
  }
});

// ── 诊断 ─────────────────────────────────────────────────────────────────
// getMatchedRules 需要 declarativeNetRequestFeedback 权限。它会触发
// "读取浏览记录"的授权提示，所以放在可选权限里按需申请，而不是安装时就要——
// 大多数用户配好就能用，不该为了排查功能吓走他们。
checkMatchesButton.addEventListener("click", async () => {
  const permission = { permissions: ["declarativeNetRequestFeedback"] };

  let granted = await chrome.permissions.contains(permission);
  if (!granted) {
    granted = await chrome.permissions.request(permission);
  }
  if (!granted) {
    setStatus(diagStatus, "未授权，无法读取命中记录", "err");
    return;
  }

  const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({});
  if (!rulesMatchedInfo.length) {
    matchedDump.hidden = true;
    setStatus(
      diagStatus,
      "最近 5 分钟内没有命中记录——先走一次登录再回来看",
      "err"
    );
    return;
  }

  matchedDump.hidden = false;
  matchedDump.textContent = rulesMatchedInfo
    .map(
      (info) =>
        `${new Date(info.timeStamp).toLocaleTimeString()}  命中规则 ${info.rule.ruleId}`
    )
    .join("\n");
  setStatus(diagStatus, `共 ${rulesMatchedInfo.length} 条`, "ok");
});

load();
