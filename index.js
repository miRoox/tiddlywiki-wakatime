const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

const wikiDir = process.env.TIDDLER_PATH;

const watcher = chokidar.watch(path.join(wikiDir, '*'), {
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', (filePath) => {
  sendHeartbeat(filePath);
});

const homeDir = os.homedir();

function sendHeartbeat(filePath) {
  const timestamp = Math.floor(Date.now() / 1000);
  const wakatimeCliPath = path.join(homeDir, '.wakatime', 'wakatime-cli');
  const command = `${wakatimeCliPath} --file "${filePath}" --time ${timestamp} --category "writing docs" --project "MyWiki"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`发送心跳时出错：${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`wakatime-cli 错误：${stderr}`);
      return;
    }
    console.log(`已为 ${filePath} 发送心跳：${stdout}`);
  });
}

console.log('Tracker 已启动');
console.log(`正在监视目录：${wikiDir}`);
