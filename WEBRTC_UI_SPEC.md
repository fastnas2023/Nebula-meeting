---
title: WebRTC UI 交互梳理与跨浏览器镜像/状态规范
scope: client/src/WebRTCMeeting.jsx
---

# 1. 总览

本项目的 WebRTC 会议主要由 [WebRTCMeeting.jsx](file:///Users/zhangjianhua/freemeeting/client/src/WebRTCMeeting.jsx) 驱动，UI 由 3 个大状态组成：

- `welcome`：加入/选择房间 + 活跃房间列表
- `setup`：设备预览与选择（相机/麦克风/昵称/画质等）
- `meeting`：会议页（视频网格/聊天/控制栏/屏幕共享/录制/角色管理）

核心原则（对齐 Meet/Zoom 的体验预期）：

- **镜像只作用于本地预览**，不对远端发送/接收画面做翻转
- **UI 状态以“事件驱动 + 可回退”为优先**：网络/权限/ICE 失败时优先提示并降级，不在 UI 层强行重试导致抖动

# 2. 状态表（UI 与 WebRTC 状态对应关系）

## 2.1 顶层 UI 状态：`uiState`

| uiState | 主要 UI | 可交互按钮 | 关键 refs/状态 | 进入条件 | 离开条件 |
|---|---|---|---|---|---|
| `welcome` | 房间输入、继续按钮、活跃房间列表、Return Room 弹窗 | Continue、Back、Join Now | `roomId`、`pendingRoomId` | 初始进入；或 `onBack()`；或房间关闭/被踢 | `joinRoom()` 触发进入 `setup` |
| `setup` | 本地预览、设备选择、昵称输入、画质设置 | Join Now、Back、Mic/Video | `previewVideoRef`、`videoStreamRef`、`audioStreamRef` | `joinRoom()` | `confirmJoin()` 成功进入 `meeting`；失败 stay |
| `meeting` | 顶部状态条、视频网格、聊天侧栏、底部控制栏、共享/录制弹窗 | 全部会议控制按钮 | `localStreamRef`、`peersRef`、`remoteStreams` | `confirmJoin()` getUserMedia 成功并 emit join-room | `onBack()`/房间关闭/被踢 |

## 2.2 信令与连接状态

| 状态字段 | 取值 | UI 显示位置 | 触发来源 |
|---|---|---|---|
| `signalingState` | `connected` / `disconnected` | 顶部状态条 WiFi 图标 | `socket.on('connect'/'disconnect'/'connect_error')` |
| `connectionStatus` | `new/checking/connected/failed/disconnected/closed` | 顶部状态条连接徽章 | `pc.onconnectionstatechange` 更新 |

## 2.3 媒体状态

| 状态字段 | UI | 本地 MediaStream 同步 | 远端同步 |
|---|---|---|---|
| `isAudioEnabled` | Mic 按钮红/灰；本地 tile 左上 MicOff | `localStreamRef.getAudioTracks().enabled` 与 `audioStreamRef` 同步 | 通过 track enabled/replaceTrack 生效（无额外信令） |
| `isVideoEnabled` | Camera 按钮红/灰；本地 tile 显示头像占位 | 关闭会 stop track 并 remove；开启会重新 getUserMedia 并 addTrack | replaceTrack / renegotiate |
| `isSharing` | Share 按钮状态；本地 tile 不镜像 | 共享视频 track 加到 `localStreamRef`，并 addTrackToPeers | replaceTrack / renegotiate |
| `isRecording` | Rec 按钮动画 | MediaRecorder 录屏（本地保存） | 不影响远端 |

# 3. 触发条件与 UI 反馈（事件 → 状态 → 反馈）

## 3.1 用户交互触发

### 加入流程

1) `welcome` 输入房间号 → 点击 Continue → `uiState = setup`
- 失败：空房间号 → toast `enter_room_id_error`

2) `setup` 点击 Join Now → `confirmJoin()`：
- 成功：getUserMedia 成功 → `uiState = meeting`，并 `socket.emit('join-room', roomId, socket.id, nickname)`
- 失败：权限/设备异常 → toast `device_access_error`，留在 `setup`

### 音视频控制

- `toggleAudio()`：只改 track.enabled，不 stop
- `toggleVideo()`：
  - 关闭：stop video track、从 stream remove、UI 显示占位
  - 开启：重新 getUserMedia(video)，addTrack 并对所有 peer replaceTrack（必要时 renegotiate）

### 屏幕共享

- `startScreenShare()`：getDisplayMedia → 打开确认弹窗（`isSharePreviewOpen`）
- `confirmScreenShare()`：将屏幕 track 加入 `localStreamRef`，并 addTrackToPeers；`isSharing=true`
- `stopScreenShare()`：停止屏幕 track，恢复相机 track（如存在），否则 removeTrackFromPeers('video')

### 全屏/排序/聊天

- 全屏：tile 内按钮触发 `toggleFullscreen(tileId)`；Esc 退出；全屏时隐藏顶部/底部栏
- 排序：底部“排序”按钮更新排序规则并持久化 localStorage
- 聊天：关闭时收到消息 `unreadCount++`；打开时清零并滚动到底

## 3.2 远端/网络回调触发

| 事件 | 触发条件 | UI 变化 | 降级/回退 |
|---|---|---|---|
| `socket.disconnect` | 信令断开 | 顶部 WiFi 变红 + toast `disconnected_signaling` | 维持本地 UI；允许用户退出/重试 |
| `socket.connect_error` | 连接失败 | toast `signaling_error` | 同上 |
| `user-connected` | 新 peer 加入 | 创建 PeerConnection，发 offer | 视频网格新增 tile |
| `user-disconnected` | peer 离开 | 移除 peer/stream/角色/元信息，toast `user_left_msg` | 网格更新 |
| `pc.connectionState = failed/closed` | ICE/DTLS 失败等 | toast `connection_lost` 并清理远端流 | 允许重连（由新连接触发） |
| `pc.iceConnectionState = disconnected` | 网络抖动 | toast `connection_unstable`；initiator 做 ICE restart | UI 保持不闪退 |
| `room-closed` | 创建者关闭 | toast `room_closed` → 返回首页 | 强制回退 |
| `user-kicked` | 被踢 | toast `you_were_kicked` → 返回首页 | 强制回退 |

# 4. 控制栏交互流程（伪代码）

## 4.1 麦克风

```ts
toggleAudio():
  enabled = !isAudioEnabled
  for track in localStream.audioTracks: track.enabled = enabled
  for track in audioStreamRef.audioTracks: track.enabled = enabled
  setIsAudioEnabled(enabled)
```

## 4.2 摄像头

```ts
toggleVideo():
  if isSharing:
    setIsVideoEnabled(!isVideoEnabled)
    set cameraTrack.enabled = new
    return

  if isVideoEnabled:
    stop+remove camera track
    setIsVideoEnabled(false)
    return

  stream = getUserMedia(video-only constraints)
  newVideoTrack = stream.videoTrack
  localStream.addTrack(newVideoTrack)
  for peer in peers:
    if sender exists: sender.replaceTrack(newVideoTrack)
    else: peer.addTrack(newVideoTrack); renegotiate offer/answer
  setIsVideoEnabled(true)
```

## 4.3 屏幕共享

```ts
startScreenShare():
  stream = getDisplayMedia()
  showPreview(stream)

confirmScreenShare():
  localStream.addTrack(screenVideoTrack)
  addTrackToPeers(screenVideoTrack)
  isSharing = true

stopScreenShare():
  stop screen tracks
  localStream.removeTrack(screenVideoTrack)
  if camera exists:
    localStream.addTrack(cameraTrack)
    addTrackToPeers(cameraTrack)
  else:
    removeTrackFromPeers('video')
  isSharing = false
```

# 5. 辅助 UI：显示/隐藏逻辑与依赖

| 功能 | 是否实现 | 依赖 | 显示逻辑 |
|---|---:|---|---|
| 成员列表侧栏 | 未实现（以视频网格代替） | `remoteStreams`、`participantMeta` | 当前通过 tile 标题/角色徽章体现 |
| 角色管理 | 已实现（hover 控制） | `roleDefinitions`、`remoteRoles`、权限 | 仅管理员/创建者显示操作按钮 |
| 网络质量指示 | 部分实现 | `signalingState`、`connectionStatus` | 顶部状态条 |
| 屏幕共享预览弹窗 | 已实现 | `isSharePreviewOpen`、`sharePreviewStream` | 开始共享后显示确认 |
| 录制 | 已实现（录屏本地保存） | `MediaRecorder`、`getDisplayMedia` | 开始录制后按钮闪烁 |
| 美颜/水印 | 未实现 | - | 建议放在本地 canvas pipeline（仅本地预览或发送端） |

# 6. 异常场景与降级策略（本地化）

## 6.1 权限拒绝 / 设备不可用

| 场景 | 可能错误 | UI 策略 | 文案 key |
|---|---|---|---|
| 用户拒绝权限 | `NotAllowedError` | stay `setup`，提示并允许重新选择设备/重试 | `device_access_error` |
| 无设备/被占用 | `NotFoundError` / `NotReadableError` | 允许只加入音频或只加入视频（当前可通过关摄像头/麦克风实现） | `device_access_error` |

## 6.2 网络断开 / ICE 失败

- 信令断开：保持会议 UI（不闪退），提示用户网络状态；用户可手动退出再加入
- ICE disconnected：提示“网络不稳定”，initiator 尝试 ICE restart；失败则清理远端流并提示

## 6.3 设备拔插

- `navigator.mediaDevices.ondevicechange`：重新 enumerateDevices 更新下拉框；不强制重启会议流（避免打断）

## 6.4 多端登录

- 当前以 `socket.id` 作为 userId；同一账号多端会被当作不同成员
- 若需要“同账号互踢/顶替”，建议引入稳定 `userId`（业务层）并在服务端做冲突策略

# 7. 单元测试与跨浏览器回归

## 7.1 单元测试（状态机）

文件：
- [webrtcUiMachine.ts](file:///Users/zhangjianhua/freemeeting/client/src/utils/webrtcUiMachine.ts)
- [webrtcUiMachine.test.ts](file:///Users/zhangjianhua/freemeeting/client/src/utils/webrtcUiMachine.test.ts)

```bash
cd client
npm test
```

## 7.2 跨浏览器回归建议

WebRTC 媒体采集在 CI 环境对 WebKit/Firefox 的“假设备”支持差异较大，建议：

- 单元测试覆盖“状态切换与 UI 反馈规则”（与浏览器无关）
- E2E 使用 Playwright 在 Chromium 侧覆盖“完整入会链路”，Firefox/WebKit 覆盖“不依赖摄像头权限”的 UI（全屏/排序/聊天等）

