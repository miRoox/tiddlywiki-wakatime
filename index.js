const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 配置
const homeDir = os.homedir(); // 获取用户主目录
const platform = os.platform() === 'win32' ? 'windows' : os.platform() === 'darwin' ? 'macos' : os.platform(); // 根据平台设置
const arch = os.arch() == 'x64' ? 'amd64' : os.arch(); // 根据架构设置
const suffix = os.platform() === 'win32' ? '.exe' : ''; // Windows 平台需要 .exe 后缀
const wakatimeCliName = `wakatime-cli-${platform}-${arch}${suffix}`; // 根据平台选择正确的 wakatime-cli 名称
const wakatimeCliPath = path.join(homeDir, '.wakatime', wakatimeCliName);
const wikiDir = process.env.TIDDLER_PATH;
const watchPattern = wikiDir; // 监控模式

// 调试函数：记录带时间戳的日志
function logDebug(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// 验证目录和 wakatime-cli 是否有效
function validateConfig() {
  logDebug(`验证配置...`);
  logDebug(`wikiDir: ${wikiDir}`);
  logDebug(`watchPattern: ${watchPattern}`);
  logDebug(`wakatimeCliPath: ${wakatimeCliPath}`);

  // 检查 tiddlers 目录是否存在
  if (!fs.existsSync(wikiDir)) {
    logDebug(`错误：tiddlers 目录不存在：${wikiDir}`);
    process.exit(1);
  }

  // 检查目录是否可读
  try {
    fs.accessSync(wikiDir, fs.constants.R_OK);
    logDebug(`tiddlers 目录可读`);
  } catch (error) {
    logDebug(`错误：无法读取 tiddlers 目录：${error.message}`);
    process.exit(1);
  }

  // 检查是否有文件
  const tidFiles = fs.readdirSync(wikiDir);
  logDebug(`找到 ${tidFiles.length} 个 文件`);

  // 检查 wakatime-cli 是否存在
  if (!fs.existsSync(wakatimeCliPath)) {
    logDebug(`错误：wakatime-cli 不存在：${wakatimeCliPath}`);
    process.exit(1);
  }
}

// 初始化 chokidar
logDebug(`初始化 chokidar，监控路径：${watchPattern}`);
const watcher = chokidar.watch(watchPattern, {
  persistent: true,
  ignoreInitial: true, // 改为 false 以捕获初始文件事件（调试用）
  awaitWriteFinish: {
    stabilityThreshold: 2000, // 等待文件写入完成
    pollInterval: 100,
  },
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
});

// chokidar 事件处理
watcher
  .on('ready', () => {
    logDebug('chokidar 已准备就绪，开始监控文件变化');
    const watchedPaths = watcher.getWatched();
    logDebug(`监控的路径和文件：${JSON.stringify(watchedPaths, null, 2)}`);
  })
  .on('add', (filePath) => {
    logDebug(`检测到新文件：${filePath}`);
    sendHeartbeat(filePath);
  })
  .on('change', (filePath) => {
    logDebug(`检测到文件修改：${filePath}`);
    sendHeartbeat(filePath);
  })
  .on('unlink', (filePath) => {
    logDebug(`检测到文件删除：${filePath}`);
  })
  .on('error', (error) => {
    logDebug(`chokidar 错误：${error.message}`);
  });

const ignorefiles = [
  '$__StoryList.tid', // 忽略 StoryList 文件
  '$__StoryList.json', // 忽略 StoryList JSON 文件
]

function getProjectName() {
  // Read the wiki title from $:/SiteTitle tiddler
  let wikiTitle = "MyWiki"; // Default fallback title
  
  try {
    const siteTitlePath = path.join(wikiDir, '$__SiteTitle.tid');
    
    if (fs.existsSync(siteTitlePath)) {
      const content = fs.readFileSync(siteTitlePath, 'utf8');
      // TiddlyWiki .tid files have metadata followed by a blank line and then content
      const contentMatch = content.match(/\n\n(.+)$/s);
      if (contentMatch && contentMatch[1]) {
        wikiTitle = contentMatch[1].trim();
        logDebug(`Found wiki title: ${wikiTitle}`);
      } else {
        logDebug('Could not extract wiki title from SiteTitle tiddler, using default: MyWiki');
      }
    } else {
      logDebug('SiteTitle tiddler not found, using default: MyWiki');
    }
  } catch (error) {
    logDebug(`Error reading wiki title: ${error.message}`);
  }
  return wikiTitle
}

const wikiTitle = getProjectName(); // 获取 TiddlyWiki 的标题

// 发送心跳到 WakaTime
function sendHeartbeat(filePath) {
  // if (path.basename(filePath).startsWith('Draft of'))
  // {
  //   logDebug(`忽略草稿文件：${filePath}`);
  //   return;
  // }
  if (filePath.endsWith('.meta')) {
    return;
  }
  if (ignorefiles.includes(path.basename(filePath))) {
    return;
  }
  
  const command = `"${wakatimeCliPath}" --plugin tiddlywiki-wakatime --entity "${filePath}" --entity-type file --category "writing docs" --alternate-language "Tiddlywiki" --alternate-project "${wikiTitle}"`;

  logDebug(`执行 wakatime-cli 命令：${command}`);
  exec(command, (error, stdout, stderr) => {
    if (error) {
      logDebug(`发送心跳时出错：${error.message}`);
      return;
    }
    if (stderr) {
      logDebug(`wakatime-cli 错误：${stderr}`);
      return;
    }
    logDebug(`心跳发送成功：${filePath}, 输出：${stdout}`);
  });
}

// 启动前验证配置
validateConfig();

logDebug('Tracker 已启动');