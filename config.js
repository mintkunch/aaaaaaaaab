const app_id = "b4482a0e-f42e-4e72-935a-a061fe405c4b" //skywayのアプリケーションID //skyway application ID
const secret_key = "vgPl2zlS5FqJ0qD2YhqM2IoSNwF2kYEChQ7qoEF9mvc=" //skywayのシークレットキー // skyway secret key
let proximity = true;  // 近接VCのtrue:有効/false:無効(デフォルトはtrue) //Proximity VC true:enable/false:disable (default: true)
let distance = 6; // 声の届く最大距離(デフォルトは6) //Max distance of sound (default: 6)
const port = 19132; // websocketをlistenするポート //Port to listen
const web_port = 8080; // 近接vcのwebサイトと接続するポート // Port to connect website
let lang = "ja"; //言語(ja:日本語, en:英語) //Language (ja:Japanese, en:English)
module.exports = { distance, app_id, secret_key, proximity, port, web_port, lang };
