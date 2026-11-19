# Philo 社区插件

这里维护 Philo 官方插件的源码、版本归档和社区目录。每个插件放在 `plugins/<id>/`，可独立开发、检查和打包。

| 插件 | 用途 | 版本 |
| --- | --- | --- |
| [版本发布简报](plugins/release-notes/README.md) | 用两个 GitHub 版本之间的提交、PR 和 Issue 起草带来源链接的发布说明。 | [v0.1.0](https://github.com/lovephilo/plugins/releases/tag/release-notes-v0.1.0) |

## 安装

```sh
philo plugin install 'https://github.com/lovephilo/plugins/releases/download/release-notes-v0.1.0/release-notes-0.1.0.tgz#sha512-5L7IFSuAlY+pbyetSE2xYyMwhCZb5IMKsfPaHakaIM4r7FmyvRdBUsiDs0pdthG6EzhEL5yDCugcbKO1Q5aCMw=='
```

在 Philo 会话中运行 `/release-notes v2.32.4 v2.32.5 psf/requests`。详见[发布简报使用说明](plugins/release-notes/README.md)。

## 开发

以发布简报插件为例。临时挂载使用源码目录，打包后会输出可用于校验的 SHA-512 摘要。

```sh
philo plugin check ./plugins/release-notes
philo --plugin ./plugins/release-notes
mkdir -p dist
philo plugin pack ./plugins/release-notes -o dist/release-notes-0.1.0.tgz
```

用 `philo plugin types ./plugins/release-notes` 生成编辑器所需的类型声明。代码回归测试可在 Node.js 22.18+ 上运行 `node --test tests/*.test.mjs`。

## 发布与目录

使用 `<id>-v<version>` 标签创建 GitHub Release，并上传该版本的 `.tgz`。验证公开下载和 SHA-512 摘要后更新 [registry.json](registry.json)。更新目录时，将上一版的归档和摘要移入条目的 `versions`。

嵌入 Philo 的宿主可以通过 `install.ManagerOptions.RegistryURLs` 显式使用[社区索引](https://raw.githubusercontent.com/lovephilo/plugins/main/registry.json)。
