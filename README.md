# Philo 社区插件

这里维护 Philo 官方插件的源码、版本归档和社区目录。每个插件放在 `plugins/<id>/`，可独立开发、检查和打包。

| 插件 | 用途 |
| --- | --- |
| [版本发布简报](plugins/release-notes/README.md) | 用两个 GitHub 版本之间的提交、PR 和 Issue 起草带来源链接的发布说明。 |

## 开发

以发布简报插件为例。临时挂载使用源码目录，打包后会输出可用于校验的 SHA-512 摘要。

```sh
philo plugin check ./plugins/release-notes
philo --plugin ./plugins/release-notes
mkdir -p dist
philo plugin pack ./plugins/release-notes -o dist/release-notes-0.1.0.tgz
```

用 `philo plugin types ./plugins/release-notes` 生成编辑器所需的类型声明。代码回归测试可在 Node.js 22.18+ 上运行 `node --test tests/*.test.mjs`。
