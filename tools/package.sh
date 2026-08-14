#!/usr/bin/env bash
# 打包上传用的 zip。只放扩展运行需要的文件——tools/ 和各种 .md 属于开发资料，
# 打进包里只会让审核多问几句。
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/sso-account-pin-${VERSION}.zip"

rm -rf dist
mkdir -p dist

zip -r -q "$OUT" \
  manifest.json \
  background.js \
  settings.js \
  options.html \
  options.css \
  options.js \
  icons

# 变量名要用 ${} 括起来：紧跟中文全角字符时，bash 会把它当成变量名的一部分
echo "已生成 ${OUT}（$(du -h "${OUT}" | cut -f1)）"
echo "包含文件："
unzip -Z1 "$OUT" | sed 's/^/  /'
