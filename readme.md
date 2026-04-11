### Jsoft_katheme_blog

 <img src="https://www.jsoftstudio.top/css/Jsoft_logo.png" width = "100" height = "100" alt="Jsoft_logo" align=center />

###### ©2024-2026 Jsoft Studio

------

<img src="https://img.shields.io/github/stars/kamcdev/Jsoft_katheme_blog.svg">

<img src="https://img.shields.io/badge/Python-3.13.7-blue">

<img src="https://img.shields.io/badge/交流QQ群-984242265-purple">

<img src="https://img.shields.io/badge/B站-J软件官方-light">

<img src="https://img.shields.io/badge/官网-www.jsoftstudio.top-yellow">

<img src="https://img.shields.io/badge/使用提示-生产环境建议使用venv虚拟环境-red">

------

目录
* [介绍](#介绍)
* [部署](#部署)
    * [克隆项目文件](#克隆)
    * [准备环境](#准备)
    * [启动项目](#启动)
* [添加内容](#添加内容)
    * [添加文章](#添加文章)
    * [添加友链](#添加友链)
* [结语](#结语)

<p id="介绍"></p>

------

# 介绍

这是一款使用flask开发的博客系统

支持文章分类，友情链接，文章信息统计，特殊Markdown样式

成品演示：[manyJ'sBlog - 个人博客](https://blog.jsoftstudio.top/)

<p id="部署"></p>

------

# 部署

<p id="克隆"></p>

1.克隆项目文件

使用git工具命令

```
git clone https://github.com/kamcdev/Jsoft_katheme_blog.git
```

或

直接下载压缩包

<p id="准备"></p>

2.准备环境

安装Python3并在安装过程中启用环境变量

进入Jsoft_katheme_blog目录

使用命令

```
pip install -r requirements.txt
```

安装预设的依赖列表

<p id="启动"></p>

3.启动项目

使用命令

```
python app.py
```

启动flask项目后端

在浏览器输入[http://127.0.0.1:26178](http://127.0.0.1:26178)

进入前端页面

你可以在文章列表中看到项目已经包含了几个示例文章

<p id="添加内容"></p>

------

# 添加内容

<p id="添加文章"></p>

1.添加文章

进入**blogs**文件夹

然后进入你想要发布的分类文件夹

创建一个名为你想要发布的文章的标题的文件夹(例如“如何配置反向代理”)

然后在文章文件夹内创建

blog.md(文章内容，必须)

config.json(文章信息，必须)

icon.png(文章封面，非必须，不传会显示为默认图标)

这三个文件，随后打开分类文件夹内的**blog_category.json**

将刚刚创建的文章填入配置，并调整分类(数字越小排序越往前)

文章添加成功！如果操作无误刷新前端即可看见文章

<p id="添加友链"></p>

2.添加友链

打开项目根目录下的**friendly_links.json**

可以看到配置内已经添加了一个示例格式

在友链配置中添加一个像

```json
{"name": "填写友链名称", "url": "https://www.jsoftstudio.top/"}
```

一样的数组

修改name为友链名称，url为地址即可

<p id="结语"></p>

------

# 结语

感谢您的体验与支持，希望您在体验便利的同时也可以贡献一份代码，为本项目的开源事业做出贡献！