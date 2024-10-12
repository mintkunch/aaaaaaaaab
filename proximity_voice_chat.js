const { Server } = require('socket-be');
let { distance, app_id, secret_key, proximity, port, web_port, lang } = require('./config.js');
const WebSocket = require('ws');
const wanakana = require('wanakana');
const fs = require('fs');
const path = require('path');

// config.jsファイルのパス
const configPath = path.join(__dirname, 'config.js');

// config.jsファイルの内容を読み込み
let configFile = fs.readFileSync(configPath, 'utf8');


let positions = {};
let shouldBroadcast = false; // ブロードキャストのタイミングを制御するフラグ
const wss = new WebSocket.Server({ port: web_port });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { userName, position } = JSON.parse(message);
    positions[userName] = position;
  });

  ws.on('close', () => {
    // 接続が切れた場合、positions からユーザーを削除するなどの処理が必要
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcastPositions() {
  const updatedPositions = JSON.stringify({
    positions,
    distance,
    app_id,
    secret_key,
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(updatedPositions);
    }
  });
}

// playersとspectatorsの処理に共通する関数を定義
function processName(name) {
  const vcname1 = name.replace(/ /g, "_");
  const senderName = wanakana.toRomaji(vcname1);
  return senderName.replace(/n'/g, "n");
}

async function handleWorld(world) {
  try {
    const players = await world.runCommand(`testfor @a`);
    const not_death = await world.runCommand(`testfor @e[type=player]`);
    let spectators = ""
    if (proximity) {
      spectators = await world.runCommand(`testfor @a[m=spectator]`);
    } else {
      spectators = await world.runCommand(`testfor @a`);
    }
    const result = await world.runCommand(`querytarget @a`);

    // resultのdetailsをパースしてJSONオブジェクトに変換
    const parsedDetails = JSON.parse(result.details);

    // positionsを初期化
    positions = {};

    // 生存しているプレイヤーの名前リストを作成
    let notDeathVictimNames = new Set();
    if (Array.isArray(not_death.victim)) {
      not_death.victim.forEach((victim) => {
        notDeathVictimNames.add(victim);
      });
    }

    // players.victimが存在するかチェック
    if (Array.isArray(players.victim)) {
      players.victim.forEach((victim, index) => {
        const processedName = processName(victim);

        // parsedDetailsに位置情報がある場合
        if (parsedDetails[index]) {
          const position = parsedDetails[index].position;

          // プレイヤーがnot_deathに含まれていなければ、座標を置き換える
          if (!notDeathVictimNames.has(victim)) {
            positions[processedName] = { x: 0, y: 20000, z: 0 }; // 死んでいるプレイヤー
          } else {
            positions[processedName] = {
              x: position.x,
              y: position.y,
              z: position.z,
            }; // 生きているプレイヤー
          }
        }
      });
    }

    // spectators.victimが存在するかチェック
    if (Array.isArray(spectators.victim)) {
      spectators.victim.forEach((victim) => {
        const processedName = processName(victim);
        positions[processedName] = { x: 0, y: 10000, z: 0 }; // 観戦モードのプレイヤー
      });
    }

    shouldBroadcast = true;
  } catch (error) {
    console.error('Error handling world:', error);
  }

  handleWorld(world);
}


function periodicBroadcast() {
  if (shouldBroadcast) {
    broadcastPositions();
    shouldBroadcast = false; // ブロードキャスト後にフラグをリセット
  }
  setTimeout(periodicBroadcast, 0); // 100ms ごとにブロードキャストチェック
}

const server = new Server({
  port: port,
  timezone: 'Asia/Tokyo'
});

server.events.on('playerChat', async (event) => {
  const { sender, message, world } = event;
  if (sender === '外部') return;
  if (message.startsWith('!dis ')) {
    dis = message.split(' ');
    if (!isNaN(dis[1])) {
      const host = await world.runCommand(`testfor @s`)
      if (sender == host.victim[0]) {
        distance = Number(dis[1]);
        configFile = configFile.replace(/let distance = \d+;/, `let distance = ${distance};`);
        fs.writeFileSync(configPath, configFile, 'utf8');
        if (lang == "ja") {
          await world.runCommand(`tellraw @a {"rawtext":[{"text":"声の最大距離を${distance}に変更しました"}]}`);
        } else {
          await world.runCommand(`tellraw @a {"rawtext":[{"text":"Changed max distance to ${distance}"}]}`);
        }
      }
    }
    console.log("distance = " + distance);

  }
  else if (message === '!name') {
    const vcname1 = sender.replace(/ /g, "_");
    senderName = wanakana.toRomaji(vcname1);
    let vcname = senderName.replace(/n'/g, "n");
    console.log(vcname);
    if (lang == "ja") {
      await world.runCommand(`tellraw "${sender}" {"rawtext":[{"text":"あなたのVCnameは${vcname}です"}]}`);
    } else {
      await world.runCommand(`tellraw "${sender}" {"rawtext":[{"text":"Your VCname is ${vcname}"}]}`);
    }
  } else if (message === '!pvc true') {
    const host = await world.runCommand(`testfor @s`)
    if (sender == host.victim[0]) {
      proximity = true
      configFile = configFile.replace(/let proximity = false;/, `let proximity = true;`);
      fs.writeFileSync(configPath, configFile, 'utf8');
      if (lang == "ja") {
        await world.runCommand(`tellraw @a {"rawtext":[{"text":"近接vcを有効にしました"}]}`);
      } else {
        await world.runCommand(`tellraw @a {"rawtext":[{"text":"proximity voice chat enabled"}]}`);
      }
    }
  } else if (message === '!pvc false') {
    const host = await world.runCommand(`testfor @s`)
    if (sender == host.victim[0]) {
      proximity = false
      configFile = configFile.replace(/let proximity = true;/, `let proximity = false;`);
      fs.writeFileSync(configPath, configFile, 'utf8');
      if (lang == "ja") {
        await world.runCommand(`tellraw @a {"rawtext":[{"text":"近接vcを無効にしました"}]}`);
      } else {
        await world.runCommand(`tellraw @a {"rawtext":[{"text":"proximity voice chat disabled"}]}`);
      }
    }
  } else if (message === '!lang ja') {
    const host = await world.runCommand(`testfor @s`)
    if (sender == host.victim[0]) {
      proximity = true
      configFile = configFile.replace(/let lang = en;/, `let lang = ja;`);
      fs.writeFileSync(configPath, configFile, 'utf8');
      await world.runCommand(`tellraw @a {"rawtext":[{"text":"言語を日本語に変更しました"}]}`);
    }
  } else if (message === '!lang en') {
    const host = await world.runCommand(`testfor @s`)
    if (sender == host.victim[0]) {
      proximity = true
      configFile = configFile.replace(/let lang = ja;/, `let lang = en;`);
      fs.writeFileSync(configPath, configFile, 'utf8');
      await world.runCommand(`tellraw @a {"rawtext":[{"text":"Language changed to English"}]}`);
    }
  } else if (message === '!help') {
    await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"--------------------"}]}`);
    if (lang == "ja") {
      await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"コマンド一覧：\n  !help - ヘルプを表示します\n  !name - VCで使う名前を確認できます"}]}`);
      const host = await world.runCommand(`testfor @s`)
      if (sender == host.victim[0]) {
        await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"ホスト専用コマンド：\n  !dis - !dis <数値> で声の届く距離を変更できます\n  !pvc - !pvc <true/false> で近接vcを有効/無効にできます\n  !lang - !lang <ja/en> chenge language"}]}`);
      }
    } else {
      await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"Command list:\n  !help - show help\n  !name - check your VC name"}]}`);
      const host = await world.runCommand(`testfor @s`)
      if (sender == host.victim[0]) {
        await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"Host-only command：\n  !dis - !dis <Number> set max distance\n  !pvc - !pvc <true/false> enable/disable proximity voice chat\n  !lang - !lang <ja/en> 言語を変更できます"}]}`);
      }
    }
    await world.runCommand(`tellraw ${sender} {"rawtext":[{"text":"--------------------"}]}`);
  }
});

server.events.on("serverOpen", () => {
  server.logger.info(`Minecraft: "/connect localhost:${port}" で接続します`)
  server.logger.log("open");
});

server.events.on("worldAdd", async (ev) => {
  const { world } = ev;
  server.logger.info(`connection opened: ${world.name}`);
  if (lang == "ja") {
    let vc = "";
    proximity ? vc = '有効' : vc = '無効';
    world.sendMessage(`接続を開始しました\n近接vc：${vc}\n声の届く距離：${distance}\n!help でコマンド一覧を確認できます`);
  } else {
    let vc = "";
    proximity ? vc = 'enabled' : vc = 'disabled';
    world.sendMessage(`Connection started\nProximity voice chat:${vc}\nMax distance:${distance}\n!help for command list`);
  }
  await handleWorld(world);
});

server.events.on("worldRemove", (ev) => {
  const { world } = ev;
  server.logger.info(`connection closed: ${world.name}`);
});

server.events.on("playerJoin", (ev) => {
  const { players } = ev;
  server.logger.info(`Joined: ${players.join(', ')}`);
});

server.events.on("playerLeave", (ev) => {
  const { players } = ev;
  server.logger.info(`Left: ${players.join(', ')}`);
  positions[players.join(', ')] = { x: 0, y: 10000, z: 0 };
});

server.events.on('error', e => {
  server.logger.error(e);
});

// 定期的にブロードキャストをチェックする処理を開始
periodicBroadcast();
