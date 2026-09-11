# Voice Chat Real-time — Giải thích chi tiết toàn bộ

Tài liệu này giải thích **tính năng voice chat đã được implement**, viết cho người lần đầu làm.
Đọc từ trên xuống: phần 1-3 là **kiến thức nền** (hiểu để làm được), phần 4 trở đi là **code cụ thể**.

---

## 1. Tính năng đã làm được gì

- Vào / rời **kênh thoại** (voice channel) nhiều người, nói chuyện real-time.
- **Mute mic** (tắt tiếng mình) và **Deafen** (tắt nghe người khác).
- **Chia sẻ màn hình** (screen share) — người khác xem được màn hình của bạn.
- **Hiển thị ai đang nói** — viền xanh quanh avatar khi có tiếng.
- **Presence**: sidebar hiện danh sách người đang ở trong từng kênh thoại, kể cả kênh bạn không vào.
- **Giữ kết nối khi chuyển kênh** — đang gọi mà bấm sang kênh text/DM thì vẫn nghe (giống Discord).
- Tự dọn dẹp khi đóng tab / logout / mất mạng.

---

## 2. Kiến thức nền — đọc kỹ phần này

### 2.1. WebRTC là gì?

WebRTC (Web Real-Time Communication) là công nghệ có sẵn trong browser cho phép **truyền âm thanh/video trực tiếp giữa 2 máy** mà không cần cài gì.

Browser cung cấp các API:
- `getUserMedia()` — xin quyền và lấy mic/camera.
- `RTCPeerConnection` — "ống" truyền media giữa 2 máy.
- `getDisplayMedia()` — lấy màn hình để chia sẻ.

**Vấn đề:** WebRTC chỉ là công cụ ở tầng thấp. Nó KHÔNG tự biết:
- Ai đang ở trong phòng?
- Làm sao tìm thấy máy kia trên internet?
- Ai được phép vào phòng?

→ Vì vậy luôn cần một **server** để lo 3 việc trên.

### 2.2. Signaling là gì? (khái niệm quan trọng nhất)

Trước khi 2 máy truyền được âm thanh, chúng phải "bắt tay" (handshake) để trao đổi thông tin kỹ thuật:

```
Máy A                                   Máy B
  |  "Tôi muốn nói chuyện"                 |
  |----------- offer ------------------>  |
  |  <--------- answer -----------------  |
  |  <---- ICE candidate (địa chỉ) -----  |
  |  ----- ICE candidate (địa chỉ) ---->  |
  |                                        |
  |========== ÂM THANH CHẠY TỪ ĐÂY =======|
```

Quá trình trao đổi `offer` / `answer` / `ICE candidate` này gọi là **signaling**.

**Điểm mấu chốt:** WebRTC **không định nghĩa signaling**. Nó để bạn tự chọn cách truyền. Trong project này, signaling chạy qua **Socket.IO** — thứ đã có sẵn cho chat text. Đó lý do tôi không thêm REST API mới cho voice.

> `ICE candidate` = "địa chỉ IP + port mà máy tôi có thể nhận kết nối". Hai máy trao đổi danh sách này để tìm đường đi chung.

### 2.3. Ba kiến trúc media: Mesh vs P2P vs SFU

Đây là quyết định kiến trúc lớn nhất. **Chúng ta chọn SFU.**

**Mesh (lưới ngang hàng)** — mỗi máy nối trực tiếp tới từng máy khác:
```
    A ----- B
    | \   / |
    |   X   |
    | /   \ |
    C ----- D
```
- Ưu: không cần server media, đơn giản.
- Nhược: 5 người → mỗi máy gửi 4 luồng và nhận 4 luồng. Upload bị nhân lên. Với 10 người là sập mạng. Screen share càng nặng hơn.

**SFU (Selective Forwarding Unit)** — server media làm trung tâm:
```
    A -----\
    B ------ [ SFU ] ------ mọi người
    C -----/
```
Mỗi máy chỉ gửi **1 luồng lên server**, server tự chia lại cho những người khác.
- Ưu: upload không tăng theo số người, chịu tải tốt, đúng cách Discord/Zoom làm.
- Nhược: cần chạy thêm server media.

**Chúng ta dùng LiveKit** — một SFU mã nguồn mở viết bằng Go, đã lo hết phần khó (ICE, forwarding, simulcast, reconnection). Việc của mình chỉ là:
1. Cấp **token** để client được phép vào phòng.
2. Client gọi thư viện `livekit-client` để connect.

> Tự viết SFU (ví dụ nhúng mediasoup) là một dự án riêng, rất nhiều code và dễ lỗi khi build native trên Windows. LiveKit cho kết quả tương đương với 1% công sức.

### 2.4. Token là gì và tại sao cần?

Nếu không có token, bất kỳ ai biết URL LiveKit cũng vào phòng bạn được. LiveKit dùng **JWT** (JSON Web Token) ký bằng `API_SECRET`:

```
FE --(1) "cho tôi token vào kênh X"--> BE
BE --(2) ký JWT: { roomJoin: true, room: "voice:X" } --> FE
FE --(3) room.connect(url, token) --> LiveKit
LiveKit --(4) verify chữ ký, cho vào --> OK
```

Token chứa **quyền**: `canPublish` (được gửi mic), `canSubscribe` (được nghe), và **room cụ thể** — nên token kênh A không dùng được cho kênh B. Token có hạn 6 giờ.

---

## 3. Bức tranh tổng thể

```
┌──────────────────┐        ┌────────────────────────┐       ┌──────────────────┐
│   FE (React)     │        │   BE (Express+SIO)     │       │   LiveKit SFU    │
│  localhost:5173  │        │     localhost:3000     │       │  localhost:7880  │
└────────┬─────────┘        └───────────┬────────────┘       └────────┬─────────┘
         │                              │                             │
         │ 1. socket 'voice:token'      │                             │
         │─────────────────────────────>│                             │
         │                              │ ký JWT (livekit-server-sdk) │
         │ 2. ack { token, url }        │                             │
         │<─────────────────────────────│                             │
         │                                                            │
         │ 3. room.connect(url, token)  ─── signaling (WebRTC) ──────>│
         │ 4. publish mic + screen      ═══ MEDIA (audio/video) ═════>│
         │                                                            │
         │ 5. socket 'voice:join'       │                             │
         │─────────────────────────────>│                             │
         │                              │ lưu vào Map presence        │
         │ 6. broadcast 'voice:presence'│                             │
         │<─────────────────────────────│                             │
```

Chia trách nhiệm rất rõ:
- **LiveKit** lo **media** (âm thanh, màn hình) và **signaling WebRTC** giữa client với nó.
- **BE của mình** chỉ lo **cấp quyền (token)** và **presence** (ai ở kênh nào) — không đụng vào media.

---

## 4. LUỒNG HOẠT ĐỘNG CHI TIẾT

### 4.1. Khi bấm nút "Kết nối"

```
1. FE: joinVoice(channelId)
2. FE → BE:  socket.emit('voice:token', { channelId })
3. BE:       kiểm tra kênh có tồn tại không (voiceChannelService)
             ký JWT với room = "voice:<channelId>"
4. BE → FE:  ack { ok: true, token, url: "ws://localhost:7880" }
5. FE:       new Room() → room.connect(url, token)
6. FE:       setMicrophoneEnabled(true)  → xin quyền mic, bắt đầu gửi tiếng
7. FE → BE:  socket.emit('voice:join', { channelId })
8. BE:       lưu socket.id vào Map voicePresence[channelId]
             broadcast 'voice:presence' cho MỌI client
9. FE (mọi client): nhận presence → sidebar cập nhật danh sách người
```

Từ bước 6 trở đi, âm thanh của bạn chảy **thẳng lên LiveKit**, không qua BE.

### 4.2. Khi người thứ hai vào cùng kênh

```
- Client B connect LiveKit cùng room "voice:<id>"
- LiveKit phát event ParticipantConnected tới A
- LiveKit gửi audio track của B tới A
- A nhận event TrackSubscribed → gắn <audio> vào DOM → nghe được B
- Vòng lặp tương tự ngược lại
```

### 4.3. Khi rời kênh / đóng tab

Có **3 tầng dọn dẹp**, cố tình làm chồng nhau để không bao giờ rò rỉ:

| Tình huống | Cơ chế |
|---|---|
| Bấm "Ngắt kết nối" | `leaveVoice()` → `room.disconnect()` + emit `voice:leave` |
| Đóng tab / mất mạng | Socket.IO phát `disconnect` → BE tự xóa khỏi Map + broadcast lại |
| Logout | `VoiceProvider` unmount → effect cleanup chạy `disconnect()` |

---

## 5. BACKEND — chi tiết từng file

Repo: `E:\Discord_remake\BE`

### 5.1. `package.json` — thêm dependency

```json
"livekit-server-sdk": "^2.19.0"
```

Thư viện chính chủ của LiveKit, dùng để **ký JWT token**. Chỉ chạy ở server vì nó cần `API_SECRET` (tuyệt đối không để lộ ra FE).

### 5.2. `.env` và `.env.example`

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

- `devkey` / `secret` là **key mặc định** của LiveKit khi chạy `--dev`. Production phải đổi.
- `LIVEKIT_URL` là `ws://` (WebSocket) chứ không phải `http://` — vì client dùng nó để mở kết nối signaling.

### 5.3. `src/config/livekit.ts` — file MỚI (nhỏ nhưng quan trọng)

Nhiệm vụ: biến thông tin user thành một JWT được phép vào 1 room cụ thể.

```ts
const accessToken = new AccessToken(apiKey, apiSecret, {
  identity,        // dùng userId
  name,            // username hiển thị
  ttl: '6h',
});

accessToken.addGrant({
  roomJoin: true,
  room,                       // "voice:<channelId>"
  canPublish: true,           // được gửi mic/màn hình
  canSubscribe: true,         // được nghe người khác
  canPublishData: true,       // được gửi data channel
});

return accessToken.toJwt();
```

**Quyết định thiết kế:** `identity = userId` (chứ không phải random). Nghĩa là nếu bạn mở 2 tab cùng tài khoản và vào cùng kênh, LiveKit coi đó là **cùng một người** và ngắt phiên cũ. Đúng hành vi Discord — tránh việc bạn nghe thấy chính mình.

### 5.4. `src/config/socket.ts` — SỬA (phần chính của BE)

File này đã có sẵn cho chat text (`p2p:message`, `group:message`). Tôi **thêm** phần voice, không sửa phần cũ.

**(a) Lưu trạng thái presence trong RAM:**

```ts
const voicePresence = new Map<string, Map<string, VoiceMember>>();
//                  channelId       socketId  { userId, username }
```

Tại sao dùng `socketId` làm key chứ không phải `userId`? Vì một người có thể mở nhiều tab. Dùng socketId thì mỗi tab là một entry riêng, và khi **một tab** đóng thì chỉ tab đó bị xóa — tab còn lại vẫn ở trong kênh. (Ở FE tôi có hàm `uniqueMembers` để gộp lại khi hiển thị, tránh thấy trùng tên.)

Tại sao để trong RAM thay vì database? Presence là dữ liệu **tạm thời**. Server restart thì mọi người đều mất kết nối, nên không cần lưu bền. Nhanh hơn DB rất nhiều.

**(b) 4 sự kiện socket mới:**

| Event | Làm gì |
|---|---|
| `voice:token` | Validate kênh tồn tại → ký JWT → trả `{ ok, token, url }` |
| `voice:join` | Thêm vào Map + cho socket vào room `voice:<id>` + broadcast presence |
| `voice:leave` | Xóa khỏi Map + broadcast presence |
| `voice:presence` | (BE → FE) gửi toàn bộ snapshot cho mọi client |

**(c) Broadcast presence — gửi cả bảng, không gửi delta:**

```ts
const presenceSnapshot = () => {
  const snapshot = {};
  voicePresence.forEach((members, channelId) => {
    if (members.size > 0) snapshot[channelId] = Array.from(members.values());
  });
  return snapshot;
};

io.emit('voice:presence', presenceSnapshot());
```

Gửi **toàn bộ** trạng thái mỗi lần thay đổi thay vì gửi "thêm/bớt ai đó". Cách này gọi là **state sync** — đơn giản hơn nhiều, và FE không bao giờ bị lệch trạng thái do mất event. Với quy mô vài trăm người, payload vẫn rất nhỏ.

**(d) Dọn khi ngắt kết nối:**

```ts
socket.on('disconnect', () => {
  removeSocketFromVoice(socket.id);   // xóa khỏi mọi kênh
  broadcastPresence();                // thông báo cho người còn lại
});
```

Đây là lưới an toàn quan trọng nhất: dù user đóng tab đột ngột hay rớt mạng, BE vẫn biết và dọn sạch.

**(e) Gửi snapshot cho client mới:**

```ts
socket.emit('voice:presence', presenceSnapshot());
```

Ngay khi kết nối, client mới nhận được trạng thái hiện tại — không cần chờ ai đó join/leave mới thấy danh sách.

---

## 6. FRONTEND — chi tiết từng file

Repo: `E:\Discord_remake\FE`

### 6.1. `package.json`

```json
"livekit-client": "^2.22.3"
```

SDK chính chủ chạy ở browser. Nó wrap toàn bộ `RTCPeerConnection`, ICE, reconnection... thành API gọn.

### 6.2. `src/voice/VoiceContext.jsx` — file MỚI, TRÁI TIM của tính năng

Đây là file quan trọng nhất. Nó gom **toàn bộ logic LiveKit** vào một chỗ, tách khỏi UI.

**Tại sao dùng Context?** Vì trạng thái voice (đang ở kênh nào, danh sách người) cần được đọc ở **nhiều nơi**: sidebar (hiện ai trong kênh), vùng chat (lưới người), status bar (nút mute). Context giải quyết việc chia sẻ state mà không phải truyền props qua 3-4 tầng.

**State nó quản lý:**

```js
currentChannelId   // đang ở kênh nào (null = không ở kênh nào)
connectionState    // 'idle' | 'connecting' | 'connected' | 'reconnecting'
participants       // mảng người trong phòng, kèm isSpeaking/isMuted/isScreenSharing
activeSpeakerId    // ai đang nói to nhất
isMuted            // mic của mình
isDeafened         // đang tắt nghe
isSharing          // đang share màn hình
error
```

**Các hàm nó expose:** `joinVoice`, `leaveVoice`, `toggleMute`, `toggleDeafen`, `toggleScreenShare`.

**Chi tiết đáng chú ý 1 — `emitWithAck`:** Socket.IO mặc định là bắn-rồi-quên. Tôi viết helper bọc nó thành Promise có timeout:

```js
socket.emit(event, payload, (res) => { clearTimeout(timer); resolve(res) })
```

Nhờ vậy `joinVoice` viết được tuần tự dễ đọc: lấy token → connect → bật mic. Và nếu BE treo, sau 8 giây nó báo lỗi thay vì quay vô hạn.

**Chi tiết đáng chú ý 2 — gắn audio vào DOM thủ công:**

```js
.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === Track.Kind.Audio) {
    const el = track.attach();
    el.autoplay = true;
    el.muted = deafenedRef.current;
    audioContainerRef.current.appendChild(el);
  }
})
```

LiveKit trả về **object track**, không phải thẻ HTML. Phải gọi `track.attach()` để nó tạo thẻ `<audio>` thật rồi tự tay gắn vào DOM. Provider render một `<div class="voice-audio-sink">` ẩn làm chỗ chứa. Và `track.detach()` khi unsubscribe để gỡ ra, tránh rò rỉ bộ nhớ.

**Chi tiết đáng chú ý 3 — `deafenedRef`:** Deafen phải áp dụng cho **cả những track gắn sau này**. Nếu chỉ set `muted` lúc bấm nút, người vào sau sẽ vẫn nghe được. Nên tôi lưu trạng thái deafen vào `useRef` và đọc nó mỗi khi gắn track mới:

```js
el.muted = deafenedRef.current;   // áp dụng cho track tương lai
```

**Chi tiết đáng chú ý 4 — `room.startAudio()`:**

```js
room.startAudio().catch(() => {})
```

Browser chặn autoplay âm thanh cho tới khi có tương tác của user. Lệnh này "mở khóa" audio. Vì nó được gọi sau cú click "Kết nối" nên hợp lệ. Nuốt lỗi vì đây chỉ là bước làm mượt, thất bại cũng không sao.

**Chi tiết đáng chú ý 5 — 3 tầng cleanup:** như đã nói ở mục 4.3, và trong `wireEvents` có `room.removeAllListeners()` để gỡ hết handler trước khi hủy room.

### 6.3. `src/components/VoiceChannelView.jsx` — file MỚI

Giao diện chính của kênh thoại, thay chỗ placeholder cũ trong `ChatArea`.

Có **2 trạng thái**:
- **Chưa kết nối** → màn "Kết nối để trò chuyện" + nút Kết nối.
- **Đã kết nối** → lưới người + stage screen share + thanh điều khiển.

Hai component con:
- `ScreenShareStage` — nhận một track màn hình, gắn vào thẻ `<video>` bằng `track.attach(el)`. Nó là component riêng vì cần `useEffect` để attach/detach đúng vòng đời.
- `ParticipantTile` — avatar một người, thêm class `voice-tile--speaking` khi `isSpeaking` để CSS vẽ viền xanh.

Điểm cần hiểu: component này **không giữ state gì cả**. Nó chỉ đọc từ `useVoice()` và gọi hàm. Mọi logic nằm ở Context.

### 6.4. `src/components/VoiceStatusBar.jsx` — file MỚI

Thanh nhỏ ở đáy sidebar, hiện khi đang trong voice.

**Tại sao cần nó?** Vì `VoiceChannelView` chỉ hiện khi bạn đang xem kênh thoại đó. Nếu bạn bấm sang kênh text, màn hình đó biến mất — nhưng bạn **vẫn đang trong cuộc gọi**. Status bar cho biết điều đó và cho nút mute/ngắt nhanh.

Đây là lý do kiến trúc quan trọng: **provider nằm ở `HomePage`, không nằm ở kênh thoại.** Nhờ vậy chuyển kênh không làm unmount room → không ngắt media.

### 6.5. `src/components/ChannelSidebar.jsx` — SỬA

- Nhận thêm 2 prop: `voicePresence` (map từ BE) và `activeVoiceChannelId`.
- Dưới mỗi kênh thoại, render danh sách avatar + tên người đang ở.
- Hàm `uniqueMembers` gộp trùng tên khi một user mở nhiều tab.
- Render `<VoiceStatusBar>` phía trên `sidebar-footer`.

### 6.6. `src/components/ChatArea.jsx` — SỬA (1 dòng)

```jsx
if (channel.type === 'voice') {
  return <VoiceChannelView channel={channel} />
}
```

### 6.7. `src/HomePage.jsx` — SỬA (quan trọng)

Tách thành 2 component:

```jsx
export default function HomePage({ user, token, onLogout }) {
  const socket = getSocket(token)
  return (
    <VoiceProvider socket={socket}>
      <HomePageContent ... socket={socket} />
    </VoiceProvider>
  )
}
```

**Tại sao tách?** `VoiceProvider` cần ở ngoài để bọc toàn bộ app. Nhưng `VoiceProvider` cung cấp hook `useVoice()`, mà hook chỉ dùng được ở component **nằm trong** provider. Nếu gọi `useVoice()` ngay trong `HomePage` (component đang render provider) thì lỗi. Nên phải tách: `HomePage` bọc provider, `HomePageContent` ở trong mới dùng được hook.

Phần còn lại: lắng nghe `voice:presence` và truyền xuống sidebar.

### 6.8. `src/HomePage.css` — SỬA

Thêm CSS cho: lưới người, viền `voice-tile--speaking`, stage screen share, thanh controls, status bar, danh sách người trong sidebar. Dùng đúng biến màu có sẵn (`--blurple`, `--bg-secondary`, `--danger`...).

---

## 7. HỢP ĐỒNG SOCKET (tóm tắt để tra cứu)

| Event | Hướng | Payload gửi | Kết quả |
|---|---|---|---|
| `voice:token` | FE → BE | `{ channelId }` | ack `{ ok, token, url }` |
| `voice:join` | FE → BE | `{ channelId }` | ack `{ ok }` |
| `voice:leave` | FE → BE | `{ channelId }` | ack `{ ok }` |
| `voice:presence` | BE → FE | `{ [channelId]: [{ userId, username }] }` | — |

Các event cũ **không đổi**: `p2p:message`, `group:message`, `join:channel`, `leave:channel`.

---

## 8. LIVEKIT SERVER — chạy thế nào

### 8.1. Lệnh

```powershell
docker run -d --name livekit-dev `
  -p 7880:7880 `
  -p 7881:7881 `
  -p 7882:7882/udp `
  livekit/livekit-server:v1.9.7 `
  --dev --bind 0.0.0.0 --node-ip 192.168.2.80
```

Ba port:
- **7880** — HTTP/WebSocket: signaling + API.
- **7881** — RTC qua TCP (dự phòng khi UDP bị chặn).
- **7882/udp** — media thật (âm thanh, màn hình). **UDP nên không được quên.**

`--dev` tự sinh key `devkey`/`secret` và bật log chi tiết.

### 8.2. `--node-ip` — CÁI BẪY QUAN TRỌNG NHẤT

**Bắt buộc khi chạy Docker. Không được bỏ.**

Khi container chạy, LiveKit nhìn thấy card mạng của Docker (`172.17.0.3`) và nhét IP đó vào **ICE candidate** — tức nó bảo browser "hãy gửi media tới địa chỉ 172.17.0.3". Nhưng browser trên Windows **không route được** vào mạng bridge nội bộ của Docker.

Kết quả: signaling kết nối thành công (nên UI báo "đã kết nối"), nhưng **không có âm thanh**. Nhìn như treo, rất khó đoán nguyên nhân.

`--node-ip <IP LAN thật>` bắt LiveKit công bố địa chỉ đúng mà browser tới được.

**Kiểm tra đã đúng chưa:**
```powershell
docker logs livekit-dev | Select-String "nodeIP"
```
Phải ra IP LAN của bạn (`192.168.2.80`), **không** phải `172.17.x.x`.

**Lấy lại IP khi mạng đổi:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
```
Chọn dòng có `InterfaceAlias` là card thật (Ethernet / Wi-Fi). **Bỏ qua** WSL, VMware, Radmin VPN — chúng là card ảo, không dùng được.

---

## 9. THỨ TỰ CHẠY

Cần **3 tiến trình** độc lập, mở 3 terminal:

```powershell
# 1. LiveKit (chạy nền, đã sẵn sàng)
docker run -d --name livekit-dev -p 7880:7880 -p 7881:7881 -p 7882:7882/udp `
  livekit/livekit-server:v1.9.7 --dev --bind 0.0.0.0 --node-ip 192.168.2.80

# 2. Backend
cd E:\Discord_remake\BE
npm run dev          # → http://localhost:3000

# 3. Frontend
cd E:\Discord_remake\FE
npm run dev          # → http://localhost:5173
```

Mở `http://localhost:5173`.

> ⚠️ **Phải dùng `localhost`, không dùng IP LAN.** `getUserMedia` (xin quyền mic) chỉ chạy trong **secure context**: `localhost` hoặc HTTPS. Nếu mở qua IP LAN, browser sẽ chặn mic mà không báo lỗi rõ ràng.

---

## 10. CÁCH TEST VỚI 2 NGƯỜI

1. Đăng nhập tài khoản A ở cửa sổ thường.
2. Mở **cửa sổ ẩn danh** (Ctrl+Shift+N) → đăng nhập tài khoản B. *(Hai tab cùng browser dùng chung quyền mic nên dễ gây khó chịu — ẩn danh tách phiên sạch hơn.)*
3. Cả hai vào cùng server → cùng một kênh thoại.
4. Bấm **Kết nối** ở cả hai.
5. Kiểm tra:
   - Nghe được nhau, avatar sáng viền xanh khi nói.
   - A bấm Mute → B thấy icon 🔇 trên avatar A.
   - B bấm Deafen → B không nghe ai, nhưng A vẫn nghe B.
   - A bấm Chia sẻ màn hình → B thấy một khung video màn hình A.
   - A bấm sang kênh text → tiếng vẫn chạy, status bar vẫn hiện.
   - Đóng tab B → A thấy B biến mất khỏi sidebar.

> 💡 **Nhớ đeo tai nghe.** Hai máy chung một chỗ, mic thu được tiếng loa → vòng lặp âm (echo/hú). Đây là hiện tượng vật lý, không phải bug.

---

## 11. DEBUG — khi có vấn đề

| Triệu chứng | Nguyên nhân thường gặp | Cách kiểm tra |
|---|---|---|
| Báo "đã kết nối" nhưng im tiếng | Thiếu/sai `--node-ip` | `docker logs livekit-dev \| Select-String nodeIP` → phải là IP LAN, không phải `172.x` |
| Nút Kết nối báo lỗi ngay | BE chưa chạy, hoặc `.env` thiếu `LIVEKIT_*` | Xem terminal BE; log BE in ra lỗi từ `createVoiceToken` |
| Browser không hỏi quyền mic | Không dùng `localhost`/HTTPS | Xem URL trên thanh địa chỉ |
| FE build lỗi thiếu module | `npm install` gỡ mất devDependencies | Chạy `npm install --include=dev` |
| Vào phòng nhưng không thấy ai | Presence sai, hoặc khác `channelId` | Mở DevTools → Network → WS → xem frame `voice:presence` |

**Xem media đang chạy:** mở `chrome://webrtc-internals` — thấy danh sách kết nối, bitrate, số byte gửi/nhận. Nếu `bytesReceived` tăng thì media đang chảy.

> ⚠️ **Cảnh báo môi trường:** máy bạn đang có `npm config omit=dev`. Mỗi lần `npm install` sẽ **gỡ hết** `typescript`, `vite`, `@types/*` → `npm run dev` và `npm run build` gãy. Luôn dùng `npm install --include=dev`, hoặc sửa dứt điểm bằng `npm config delete omit`.

---

## 12. HẠN CHẾ ĐÃ BIẾT & HƯỚNG MỞ RỘNG

**Chưa làm (cố ý, ngoài phạm vi v1):**
- Gọi thoại DM 1-1 và gọi nhóm DM.
- Bật camera (mới chỉ có screen share).
- Nút "Deafen" chưa tự động mute mic kèm (Discord làm vậy).
- Chưa lưu lịch sử cuộc gọi / tin nhắn "X đã tham gia cuộc gọi".
- Chưa cấu hình TURN — chỉ cần khi deploy thật qua NAT chặt.

**Nếu deploy production:**
- Đổi `LIVEKIT_API_KEY`/`SECRET`, **không dùng `devkey`/`secret`**.
- Bỏ `--dev`, viết file `livekit.yaml` cấu hình TURN và SSL.
- Chạy LiveKit sau HTTPS/WSS (bắt buộc để mic hoạt động trên domain thật).
- Cân nhắc `Redis` cho LiveKit nếu chạy nhiều node.

**Về scale:** LiveKit là SFU nên chịu tải tốt hơn mesh rất nhiều. Một server đơn thừa sức cho vài chục người. Chỉ cần lo bandwidth và bật simulcast khi phòng đông.

---

## 13. BẢN ĐỒ FILE — tra cứu nhanh

**Backend `E:\Discord_remake\BE`**
```
src/config/livekit.ts        MỚI   — ký JWT token
src/config/socket.ts         SỬA   — thêm 4 event voice + presence store
.env / .env.example          SỬA   — thêm LIVEKIT_API_KEY / SECRET / URL
package.json                 SỬA   — thêm livekit-server-sdk
```

**Frontend `E:\Discord_remake\FE`**
```
src/voice/VoiceContext.jsx          MỚI — toàn bộ logic LiveKit (quan trọng nhất)
src/components/VoiceChannelView.jsx MỚI — giao diện trong kênh thoại
src/components/VoiceStatusBar.jsx   MỚI — thanh voice cố định ở sidebar
src/components/ChannelSidebar.jsx   SỬA — hiện presence + status bar
src/components/ChatArea.jsx         SỬA — render VoiceChannelView
src/HomePage.jsx                    SỬA — bọc VoiceProvider + nghe presence
src/HomePage.css                    SỬA — toàn bộ CSS cho voice
package.json                        SỬA — thêm livekit-client
```

---

## 14. TÓM TẮT MỘT CÂU

Socket.IO làm **signaling + cấp quyền + presence** (thứ đã có sẵn cho chat), LiveKit làm **SFU truyền media** (thứ không thể tự viết trong thời gian ngắn), còn React Context giữ **trạng thái cuộc gọi tách khỏi UI** để chuyển kênh mà không ngắt kết nối.
