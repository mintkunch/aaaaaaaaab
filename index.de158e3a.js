const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;
const url = "wss://<\u30B5\u30D6\u30C9\u30E1\u30A4\u30F31\u3064\u76EE>.tcpexposer.com"; //サーバー側と接続するためのws/// ws to connect with the server side
const slider = {};
let Members = 0;
const userLang = navigator.language || navigator.userLanguage;
let lang = userLang.startsWith("ja") ? "ja" : "en";
async function fetchAppIdAndSecretId() {
    const socket = new WebSocket(url);
    return new Promise((resolve, reject)=>{
        socket.addEventListener("open", ()=>{
            console.log("WebSocket connection established");
        });
        socket.addEventListener("message", (event)=>{
            const data = JSON.parse(event.data);
            if (data.app_id && data.secret_key) {
                resolve({
                    app_id: data.app_id,
                    secret_key: data.secret_key
                });
                socket.close();
            }
        });
        socket.addEventListener("error", (error)=>{
            console.error("WebSocket error:", error);
            reject(error);
        });
        socket.addEventListener("close", ()=>{
            console.log("WebSocket connection closed");
        });
    });
}
async function establishWebSocketConnection() {
    let socket;
    const connect = ()=>{
        return new Promise((resolve, reject)=>{
            socket = new WebSocket(url);
            socket.addEventListener("open", ()=>{
                console.log("WebSocket connection established");
                resolve(socket);
            });
            socket.addEventListener("error", (error)=>{
                console.error("WebSocket error:", error);
                reject(error);
            });
            socket.addEventListener("close", ()=>{
                console.log("WebSocket connection closed");
            });
        });
    };
    try {
        socket = await connect();
        return socket;
    } catch (error) {
        console.error("Failed to establish WebSocket connection:", error);
        throw error;
    }
}
async function SkyWay_main(token, userName) {
    const { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } = skyway_room;
    const buttonArea = document.getElementById("button-area");
    const remoteMediaArea = document.getElementById("remote-media-area");
    const roomNameInput = "transceiver";
    const myId = document.getElementById("my-id" + (lang === "ja" ? "-jp" : ""));
    const myName = document.getElementById("my-name" + (lang === "ja" ? "-jp" : ""));
    const Memberselem = document.getElementById("Members" + (lang === "ja" ? "-jp" : ""));
    const IdDisp = document.getElementById("id-disp" + (lang === "ja" ? "-jp" : ""));
    const joinButton = document.getElementById("join" + (lang === "ja" ? "-jp" : ""));
    const target = document.getElementById("MuteInfo" + (lang === "ja" ? "-jp" : ""));
    const NonMutebtn = document.getElementById("NonMute-btn" + (lang === "ja" ? "-jp" : ""));
    const leavebtn = document.getElementById("leave" + (lang === "ja" ? "-jp" : ""));
    const participantList = document.getElementById("participant-list" + (lang === "ja" ? "-jp" : ""));
    let isMuted = false;
    const userPositions = {};
    const socket = await establishWebSocketConnection();
    // マイクストリームの取得
    let audio = null;
    try {
        audio = await SkyWayStreamFactory.createMicrophoneAudioStream({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
    } catch (error) {
        console.warn("\u30DE\u30A4\u30AF\u306E\u6A29\u9650\u304C\u306A\u3044\u304B\u3001\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002\u30DF\u30E5\u30FC\u30C8\u3067\u53C2\u52A0\u3057\u307E\u3059\u3002");
        if (lang === "ja") alert("\u30DE\u30A4\u30AF\u306E\u6A29\u9650\u304C\u306A\u3044\u305F\u3081\u3001\u30DF\u30E5\u30FC\u30C8\u3067\u53C2\u52A0\u3057\u307E\u3059\u3002");
        else alert("You will join muted since microphone access is not granted.");
        isMuted = true;
    }
    if (roomNameInput === "") return;
    const context = await SkyWayContext.Create(token);
    const room = await SkyWayRoom.FindOrCreate(context, {
        type: "p2p",
        name: roomNameInput
    });
    const me = await room.join({
        name: userName
    });
    // マイクストリームが取得できた場合のみ公開する
    let publication = null;
    if (audio) publication = await me.publish(audio);
    console.log(`${userName} is connected`);
    if (lang === "ja") {
        target.textContent = isMuted ? "\u30DF\u30E5\u30FC\u30C8\u4E2D" : "\u30DF\u30E5\u30FC\u30C8\u89E3\u9664\u4E2D";
        Memberselem.textContent = Members + "\u4EBA";
    } else {
        target.textContent = isMuted ? "Muted" : "Unmuted";
        Memberselem.textContent = Members + "people";
    }
    NonMutebtn.style.backgroundColor = isMuted ? "red" : "rgb(147, 235, 235)";
    myId.textContent = me.id;
    myName.textContent = userName;
    IdDisp.style.visibility = "visible";
    NonMutebtn.style.visibility = "visible";
    NonMutebtn.style.opacity = 1;
    joinButton.style.visibility = "hidden";
    leavebtn.style.visibility = "visible";
    leavebtn.onclick = ()=>{
        me.leave();
        location.reload();
    };
    // ミュートボタンの処理
    NonMutebtn.addEventListener("click", async ()=>{
        if (isMuted) {
            // ミュート解除時にマイクの権限を要求
            const micPermissionStatus = await navigator.permissions.query({
                name: "microphone"
            });
            // マイク権限が「拒否」されている場合は、権限を要求する
            if (micPermissionStatus.state !== "granted") try {
                // 権限が付与され、マイクが有効になった場合にミュート解除
                isMuted = false;
                if (lang === "ja") target.textContent = "\u30DF\u30E5\u30FC\u30C8\u89E3\u9664\u4E2D";
                else target.textContent = "Unmuted";
                NonMutebtn.style.backgroundColor = "rgb(147, 235, 235)";
                // マイクストリームの取得を試みる
                const audio = await SkyWayStreamFactory.createMicrophoneAudioStream({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                // ストリームが取得できた場合、パブリッシュする
                if (publication) await publication.replace(audio);
                else publication = await me.publish(audio);
                await publication.enable();
            } catch (error) {
                // 権限が付与され、マイクが有効になった場合にミュート解除
                isMuted = true;
                if (lang === "ja") target.textContent = "\u30DF\u30E5\u30FC\u30C8\u4E2D";
                else target.textContent = "Muted";
                NonMutebtn.style.backgroundColor = "red";
                // マイク権限が拒否された場合の処理
                console.error("\u30DE\u30A4\u30AF\u6A29\u9650\u304C\u62D2\u5426\u3055\u308C\u307E\u3057\u305F\u3002\u30DF\u30E5\u30FC\u30C8\u306E\u307E\u307E\u3067\u3059\u3002", error);
                if (lang === "ja") alert("\u30DE\u30A4\u30AF\u306E\u6A29\u9650\u304C\u62D2\u5426\u3055\u308C\u305F\u305F\u3081\u3001\u30DF\u30E5\u30FC\u30C8\u89E3\u9664\u3067\u304D\u307E\u305B\u3093\u3002");
                else alert("Microphone access was denied. Unable to unmute.");
            }
            else {
                // 既にマイクの権限が付与されている場合は、普通にミュート解除
                await publication.enable();
                isMuted = false;
                if (lang === "ja") target.textContent = "\u30DF\u30E5\u30FC\u30C8\u89E3\u9664\u4E2D";
                else target.textContent = "Unmuted";
                NonMutebtn.style.backgroundColor = "rgb(147, 235, 235)";
            }
        } else {
            // ミュート状態にする
            isMuted = true;
            if (lang === "ja") target.textContent = "\u30DF\u30E5\u30FC\u30C8\u4E2D";
            else target.textContent = "Muted";
            NonMutebtn.style.backgroundColor = "red";
            await publication.disable();
        }
    });
    // 参加者リストの更新関数
    const updateParticipantList = ()=>{
        Members = 0;
        participantList.innerHTML = "";
        room.members.forEach((member)=>{
            Members++; // ここでもメンバー数を増やす
            if (lang === "ja") Memberselem.textContent = Members + "\u4EBA";
            else Memberselem.textContent = Members + "people";
            const listItem = document.createElement("li");
            const volumeSlider = document.createElement("input");
            const volumeIcon = document.createElement("span"); // 🔊アイコン用の要素
            // 参加者の名前を取得
            const name = member.name || member.id;
            listItem.textContent = name;
            // 音量アイコンを追加
            volumeIcon.textContent = "\uD83D\uDD0A";
            volumeIcon.style.marginLeft = "10px"; // 名前とアイコンの間隔を調整
            // 音量調整用のスライダーを作成
            volumeSlider.type = "range";
            volumeSlider.min = "0";
            volumeSlider.max = "100";
            volumeSlider.value = slider[member.name] !== undefined ? slider[member.name] : 100; // スライダーの初期値は保存されている値、なければ100
            // スライダーの変更イベントをリッスンし、sliderオブジェクトに値を保存
            volumeSlider.addEventListener("input", ()=>{
                slider[member.name] = volumeSlider.value; // スライダーの値をslider[member.name]に保存
                if (slider[member.name] == 0) volumeIcon.textContent = "\uD83D\uDD07";
                else if (slider[member.name] > 50) volumeIcon.textContent = "\uD83D\uDD0A";
                else if (slider[member.name] <= 50 && slider[member.name] > 25) volumeIcon.textContent = "\uD83D\uDD09";
                else if (slider[member.name] <= 25 && slider[member.name] > 0) volumeIcon.textContent = "\uD83D\uDD08";
            });
            // リストアイテムにアイコンとスライダーを追加
            listItem.appendChild(volumeIcon);
            listItem.appendChild(volumeSlider);
            participantList.appendChild(listItem);
        });
    };
    // subscribeAndAttach内で呼ばれる音量調整関数を修正
    const subscribeAndAttach = async (publication)=>{
        if (publication.publisher.id === me.id) return;
        const subscribeButton = document.createElement("button");
        subscribeButton.textContent = `${publication.publisher.name || publication.publisher.id}: ${publication.contentType}`;
        buttonArea.appendChild(subscribeButton);
        subscribeButton.onclick = async ()=>{
            try {
                const { stream } = await me.subscribe(publication.id);
                const oldMediaElement = remoteMediaArea.querySelector(`[data-username="${publication.publisher.name || publication.publisher.id}"]`);
                if (oldMediaElement) remoteMediaArea.removeChild(oldMediaElement);
                let newMedia;
                switch(stream.track.kind){
                    case "audio":
                        newMedia = document.createElement("audio");
                        newMedia.controls = true;
                        newMedia.autoplay = true;
                        newMedia.setAttribute("data-username", publication.publisher.name || publication.publisher.id);
                        newMedia.volume = 0;
                        break;
                    default:
                        return;
                }
                stream.attach(newMedia);
                remoteMediaArea.appendChild(newMedia);
                // WebSocketのメッセージイベントをリッスンし、位置データに基づいて音量を調整
                socket.addEventListener("message", (event)=>{
                    const data = JSON.parse(event.data);
                    const positions = data.positions;
                    serverDistance = data.distance;
                    for (const [name, position] of Object.entries(positions)){
                        if (!userPositions[name]) userPositions[name] = {
                            x: 0,
                            y: 10000,
                            z: 0
                        };
                        else if (!position || Object.keys(position).length === 0) userPositions[name] = {
                            x: 0,
                            y: 10000,
                            z: 0
                        };
                        else userPositions[name] = position;
                        const mediaElement = document.querySelector(`[data-username="${name}"]`);
                        if (name !== myName.textContent && mediaElement && userPositions[myName.textContent] && userPositions[name] && position && Object.keys(position).length >= 1) adjustVolume(mediaElement, userPositions[myName.textContent], userPositions[name], name);
                    }
                });
            } catch (error) {
                console.error("Failed to subscribe to publication:", error);
            }
        };
        subscribeButton.click();
        updateParticipantList(); // 参加者リストの更新
    };
    room.onStreamPublished.add((e)=>{
        subscribeAndAttach(e.publication);
    });
    room.onMemberJoined.add((e)=>{
        // メンバー数を更新する
        updateParticipantList();
    });
    room.onMemberLeft.add((e)=>{
        updateParticipantList();
    });
    room.publications.forEach((publication)=>{
        subscribeAndAttach(publication);
    });
    updateParticipantList(); // 初期参加者リストの更新
    if (publication) await publication.enable();
}
// ページ読み込み時にボタンイベントハンドラを設定
window.onload = async function() {
    const joinButton = document.getElementById("join" + (lang === "ja" ? "-jp" : ""));
    joinButton.onclick = async ()=>{
        const userName = document.getElementById("user-name" + (lang === "ja" ? "-jp" : "")).value.trim();
        if (userName === "") {
            if (lang === "ja") alert("\u540D\u524D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
            else alert("Please enter your name.");
            return;
        }
        try {
            // WebSocketでapp_idとsecret_idを取得
            const { app_id, secret_key } = await fetchAppIdAndSecretId();
            // Tokenの作成
            const Token = new SkyWayAuthToken({
                jti: uuidV4(),
                iat: nowInSec(),
                exp: nowInSec() + 259200,
                scope: {
                    app: {
                        id: app_id,
                        turn: true,
                        actions: [
                            "read"
                        ],
                        channels: [
                            {
                                id: "*",
                                name: "*",
                                actions: [
                                    "write"
                                ],
                                members: [
                                    {
                                        id: "*",
                                        name: "*",
                                        actions: [
                                            "write"
                                        ],
                                        publication: {
                                            actions: [
                                                "write"
                                            ]
                                        },
                                        subscription: {
                                            actions: [
                                                "write"
                                            ]
                                        }
                                    }
                                ],
                                sfuBots: [
                                    {
                                        actions: [
                                            "write"
                                        ],
                                        forwardings: [
                                            {
                                                actions: [
                                                    "write"
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }).encode(secret_key);
            await SkyWay_main(Token, userName);
        } catch (error) {
            console.error("Error:", error);
        }
    };
    navigator.permissions.query({
        name: "microphone"
    }).then((result)=>{
        if (result.state === "granted") console.log("\u30DE\u30A4\u30AF\u3092\u5229\u7528\u3057\u307E\u3059");
        else {
            if (lang === "ja") alert("\u30DE\u30A4\u30AF\u3092\u4F7F\u7528\u3059\u308B\u6A29\u9650\u3092\u4E0E\u3048\u3066\u4E0B\u3055\u3044");
            else alert("Please grant microphone permissions.");
            console.log("\u30DE\u30A4\u30AF\u306E\u6A29\u9650\u53D6\u5F97\u30A8\u30E9\u30FC\u3067\u3059");
        }
    });
};
function calculateDistance(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2));
}
// 音量調整を位置データとスライダーの値を使って行う関数
function adjustVolume(mediaElement, pos1, pos2, name) {
    if (!pos1 || !pos2 || typeof pos1.x !== "number" || typeof pos1.y !== "number" || typeof pos1.z !== "number" || typeof pos2.x !== "number" || typeof pos2.y !== "number" || typeof pos2.z !== "number") {
        console.error("Invalid positions:", pos1, pos2);
        mediaElement.volume = 0;
        mediaElement.muted = true;
        return;
    }
    const sliderValue = slider[name] !== undefined ? Number(slider[name]) : 100; // デフォルト値は100
    const SliderVolume = sliderValue / 100;
    const distance = calculateDistance(pos1, pos2);
    const minVolume = 0;
    const volume = Math.max(minVolume, 1 - distance / serverDistance); // serverDistance を使用
    if (volume == 0) {
        mediaElement.volume = minVolume;
        mediaElement.muted = true;
    } else {
        mediaElement.volume = volume * SliderVolume;
        mediaElement.muted = false;
    }
}

//# sourceMappingURL=index.de158e3a.js.map
