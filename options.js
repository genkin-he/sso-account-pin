import {
  getSettings,
  saveSettings,
  parseDomains,
  normalizeAccountRules,
  allOrigins,
  isComplete,
  isSsoPartial,
  hasAnyConfig,
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
const accountGroupsEl = document.getElementById("account-groups");
const accountsEmptyNote = document.getElementById("accounts-empty");
const addGroupButton = document.getElementById("add-group");
const groupTemplate = document.getElementById("account-group-template");
const saveBar = document.getElementById("save-bar");

const EXPORT_FILENAME = "sso-account-pin-config.json";

// ── 文案 ─────────────────────────────────────────────────────────────────

const t = (key, ...substitutions) => chrome.i18n.getMessage(key, substitutions);

// 文案里 `反引号` 渲染成 <code>，*星号* 渲染成 <strong>。
// 用 createElement + textContent 逐段拼，不碰 innerHTML——文案虽然是自己
// 打包进去的，但 innerHTML 是审核的敏感词，能绕开就绕开。
const MARKUP = /(`[^`]+`|\*[^*]+\*)/g;

function renderMessage(element, message) {
  element.textContent = "";
  for (const part of message.split(MARKUP)) {
    if (!part) continue;
    if (part.startsWith("`") || part.startsWith("*")) {
      const tag = document.createElement(part.startsWith("`") ? "code" : "strong");
      tag.textContent = part.slice(1, -1);
      element.append(tag);
    } else {
      element.append(part);
    }
  }
}

// root 可以是 document，也可以是刚 clone 出来的模板片段
function applyI18n(root) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    renderMessage(element, t(element.dataset.i18n));
  }
}

function setStatus(element, message, kind) {
  element.textContent = message;
  element.className = kind || "";
}

// ── 标签页 ───────────────────────────────────────────────────────────────
// 标签栏在 form 外面，因为备份和诊断两个面板不属于表单。

const tabs = [...document.querySelectorAll('[role="tab"]')];

// 只有这两个面板有东西可存，其余标签页把保存栏收起来
const SAVEABLE_TABS = new Set(["sso", "accounts"]);

function selectTab(name) {
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(selected));
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  saveBar.hidden = !SAVEABLE_TABS.has(name);
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
}

// ── 账号绑定 ─────────────────────────────────────────────────────────────

function renumberGroups() {
  const groups = [...accountGroupsEl.querySelectorAll(".group")];
  groups.forEach((node, index) => {
    node.querySelector(".group-index").textContent = t("groupIndex", String(index + 1));
  });
  accountsEmptyNote.hidden = groups.length > 0;
}

function addGroup(group = { email: "", domains: [] }) {
  const fragment = groupTemplate.content.cloneNode(true);
  applyI18n(fragment);

  const node = fragment.querySelector(".group");
  node.querySelector(".group-email").value = group.email;
  node.querySelector(".group-domains").value = group.domains.join("\n");
  node.querySelector(".remove-group").addEventListener("click", () => {
    node.remove();
    renumberGroups();
  });

  accountGroupsEl.append(node);
  renumberGroups();
  return node;
}

function readAccountGroups() {
  // 规范化交给 settings.js：空组会在那里被丢掉，两边口径一致
  return normalizeAccountRules(
    [...accountGroupsEl.querySelectorAll(".group")].map((node) => ({
      email: node.querySelector(".group-email").value,
      domains: node.querySelector(".group-domains").value,
    }))
  );
}

addGroupButton.addEventListener("click", () => {
  addGroup().querySelector(".group-email").focus();
});

// ── 表单 ─────────────────────────────────────────────────────────────────

function syncAuthuserEnabled() {
  authuserInput.disabled = !useAuthuserInput.checked;
}

function fillForm(settings) {
  emailInput.value = settings.email;
  domainsInput.value = settings.domains.join("\n");
  useAuthuserInput.checked = settings.useAuthuser;
  authuserInput.value = settings.authuser;
  syncAuthuserEnabled();

  accountGroupsEl.textContent = "";
  for (const group of settings.accountRules) addGroup(group);
  renumberGroups();
}

function readForm() {
  return {
    email: emailInput.value.trim(),
    domains: parseDomains(domainsInput.value),
    useAuthuser: useAuthuserInput.checked,
    authuser: authuserInput.value.trim(),
    accountRules: readAccountGroups(),
  };
}

async function load() {
  applyI18n(document);
  document.title = t("optionsTitle");
  // zh_CN → zh-CN，让屏幕阅读器和拼写检查用对语言
  document.documentElement.lang = t("@@ui_locale").replace("_", "-");

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

  // 两块功能挂的参数不一样了，所以逐条列出各自的参数，不再抽出来说一次
  const lines = rules.map((rule) => {
    const params = rule.action.redirect.transform.queryTransform.addOrReplaceParams
      .map((param) => `${param.key}=${param.value}`)
      .join("  ");
    const matcher = rule.condition.regexFilter || rule.condition.urlFilter;
    return `  ${String(rule.id).padStart(3)}  ${params}\n       ${matcher}`;
  });
  rulesDump.textContent = t("rulesCount", String(rules.length)) + "\n\n" + lines.join("\n");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = readForm();

  if (!hasAnyConfig(settings)) {
    setStatus(statusEl, t("statusIncomplete"), "err");
    return;
  }
  // 邮箱和域名只填了一个的话，SSO 那块静默不生效，得说一声
  if (isSsoPartial(settings)) {
    setStatus(statusEl, t("statusSsoPartial"), "err");
    selectTab("sso");
    return;
  }

  // 域名是用户填的，对应的 host 权限只能在这里按需申请——
  // 必须由点击这类用户手势触发，不能在后台静默调用。
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: allOrigins(settings) });
  } catch (err) {
    setStatus(statusEl, t("statusPermissionFailed", err.message), "err");
    return;
  }

  if (!granted) {
    setStatus(statusEl, t("statusNotGranted"), "err");
    return;
  }

  await saveSettings(settings);
  // 后台监听 storage 变化后重建规则，稍等一下再读取展示
  setTimeout(showActiveRules, 300);

  fillForm(settings);
  setStatus(
    statusEl,
    isComplete(settings)
      ? t("statusSaved", settings.email)
      : t("statusSavedAccountsOnly", String(settings.accountRules.length)),
    "ok"
  );
});

useAuthuserInput.addEventListener("change", syncAuthuserEnabled);

// ── 备份 ─────────────────────────────────────────────────────────────────
// 走 Blob + <a download>，不用 downloads 权限——那个权限会多一条授权提示，
// 为了导出一个几百字节的文件不值得。

exportButton.addEventListener("click", () => {
  // 导出表单里的内容而不是已保存的配置：两者在正常情况下一致，
  // 不一致时用户看到什么就该导出什么。
  const settings = readForm();
  if (!hasAnyConfig(settings)) {
    setStatus(backupStatus, t("backupIncomplete"), "err");
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

  setStatus(backupStatus, t("backupExported", EXPORT_FILENAME), "ok");
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
    //
    // 切回配置页：保存栏只在那边显示，提示留在备份页的话用户看不到按钮。
    setStatus(backupStatus, "", "");
    selectTab("sso");
    setStatus(statusEl, t("backupImported"), "ok");
  } catch (err) {
    // parseSettingsFile 抛的是消息键；真出了别的意外就退回原始文本
    const reason = t(err.message) || err.message;
    setStatus(backupStatus, t("backupImportFailed", reason), "err");
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
    setStatus(diagStatus, t("diagNotGranted"), "err");
    return;
  }

  const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({});
  if (!rulesMatchedInfo.length) {
    matchedDump.hidden = true;
    setStatus(diagStatus, t("diagNoMatches"), "err");
    return;
  }

  matchedDump.hidden = false;
  matchedDump.textContent = rulesMatchedInfo
    .map((info) =>
      t(
        "matchedRuleLine",
        new Date(info.timeStamp).toLocaleTimeString(),
        String(info.rule.ruleId)
      )
    )
    .join("\n");
  setStatus(diagStatus, t("diagCount", String(rulesMatchedInfo.length)), "ok");
});

load();
