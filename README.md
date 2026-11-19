# 版本发布简报

在 Philo 会话里运行 `/release-notes BASE HEAD [OWNER/REPO]`，生成带来源链接的 Markdown 草稿，涵盖用户可见变化、修复、升级事项和待确认项。

## 试一个真实版本

```text
/release-notes v2.32.4 v2.32.5 psf/requests
```

这段比较包含 14 个提交。草稿的升级事项应提到 Requests 增加 Python 3.14 支持、停止支持 Python 3.8。 [兼容性变更 PR](https://github.com/psf/requests/pull/6993) · [完整版本比较](https://github.com/psf/requests/compare/v2.32.4...v2.32.5)

常用同一个仓库时，可以设置默认值。之后在命令中只传入两个版本。

```sh
philo plugin config set release-notes repository=psf/requests
```

作为 SDK 嵌入使用时，将插件清单与 JS 宿主和 Skills 一起加载。会话可以调用 `release_notes_compare` 和 `release-brief` Skill。daemon 额外提供 `/release-notes` 模板，也可以在普通会话中通过 `@` 选择 `release-brief`。

## GitHub 访问与比较范围

- 公共仓库可以直接使用。私有仓库可配置限定仓库范围的 GitHub fine-grained token，授予 **Contents**、**Pull requests** 和 **Issues** 的读取权限。将 token 通过标准输入交给 `philo plugin secret set release-notes github-token --stdin`，宿主会将其附加到发往 `api.github.com` 的 HTTPS 请求。
- 将旧版放在前面，新版放在后面。每次支持最多 40 个提交，大版本可分段比较后合并草稿。结果包含固定到提交 SHA 的比较链接。
- 工具从 GitHub 获取关联的已合并 PR，并检查 PR 描述和提交说明中用 `Fixes #123` 等关单关键词指向的同仓库 Issue，最多查询 8 条。若关联查询失败或达到上限，证据里会列出相应提示。
- 工具只读 GitHub，草稿留在当前会话供维护者核对。

如果 Philo 提示 `api.github.com` 解析到了受限 IP，请检查本机 VPN 或 DNS 代理是否为该域名返回了 fake-IP。在网络客户端中为该域名使用真实 DNS 解析后重试。
