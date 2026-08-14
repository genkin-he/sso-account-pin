# Privacy Policy — SSO Account Pin

_Last updated: 2026-08-13_

## Summary

SSO Account Pin does not collect, transmit, or sell any data. Everything you enter
stays in your own browser.

## What the extension stores

| Data | Why | Where it is stored |
|---|---|---|
| The email address you configure | Added as the `login_hint` parameter on your organization's sign-in request so the correct account is selected | `chrome.storage.sync` |
| The domain list you configure | Used to recognize which sign-in requests belong to your organization | `chrome.storage.sync` |
| Optional account index (`authuser`) | Alternative way to select the account when `login_hint` is not enough | `chrome.storage.sync` |

`chrome.storage.sync` is provided by Chrome. If you have Chrome Sync enabled, Chrome
replicates this data across your own signed-in Chrome instances. That transfer is
handled entirely by Google as part of Chrome Sync — the extension itself never sends
data anywhere.

The options page can export these settings to a JSON file on your own computer, and
read such a file back. This happens only when you click the export or import button.
The file is written to your local downloads folder and is never uploaded anywhere.

## What the extension does NOT do

- No analytics, telemetry, crash reporting, or usage tracking
- No remote servers; the extension makes no network requests of its own
- No reading of page content — it never injects scripts into web pages
- No access to passwords, cookies, or session tokens
- No advertising, and no sale or sharing of data with third parties

## How the extension works

The extension uses Chrome's `declarativeNetRequest` API. Rules are evaluated by
Chrome itself, inside the browser. The extension declares rules of the form
"when a sign-in URL matching my configured domains is requested, append
`login_hint=<my email>`". The extension never observes the requests — Chrome applies
the rule and the extension is not notified.

The only exception is the optional diagnostics feature. If you explicitly grant the
`declarativeNetRequestFeedback` permission by clicking the diagnostics button, the
extension can read which of *its own rules* matched recently, so you can tell whether
the configuration is working. This is off by default, requires an explicit click, and
can be revoked at any time from the extension's details page.

## Permissions

| Permission | Why it is needed |
|---|---|
| `declarativeNetRequest` | Add the `login_hint` parameter to your organization's sign-in requests |
| `storage` | Save your settings |
| `accounts.google.com` host access | The sign-in requests being modified are on this host |
| Host access for your configured domains | Chrome requires access to the request initiator for a redirect rule to apply. Requested only for the domains you enter; never for all sites |
| `declarativeNetRequestFeedback` (optional) | Diagnostics only. Requested on demand, revocable |

## Removing your data

Uninstalling the extension removes its stored settings. You can also clear them by
emptying the fields on the options page, or by removing the extension's data through
Chrome's settings.

## Contact

Questions about this policy can be raised through the extension's support link on its
Chrome Web Store listing.
