# Audio Call Flow

As of 2026-03-09 on `main` branch.

```
speakText(text, voice, signal)                    ← TTS, NB grant in caller
│
└─ _speakRawText_withHandle(rawText, engine)
     │
     ├─ [RPC: elevenlabs/openai/inworld/localai]
     │    │
     │    ├─ speexSynthesize_RPC()                ← tRPC streaming synthesis
     │    │
     │    └─ AudioAutoPlayer                      ← picks strategy per browser
     │         │
     │         ├─ [streaming: Chrome/Safari/Edge]
     │         │    │
     │         │    └─ AudioLivePlayer
     │         │         ├─ new Audio()
     │         │         ├─ new MediaSource()
     │         │         ├─ addSourceBuffer('audio/mpeg')
     │         │         ├─ enqueueChunk() → appendBuffer()  ← plays live as chunks arrive
     │         │         ├─ endPlayback() → endOfStream()
     │         │         ├─ waitForPlaybackEnd() → 'ended' event
     │         │         └─ stop() → pause + abort + close
     │         │
     │         └─ [accumulated: Firefox fallback]
     │              │
     │              ├─ enqueueChunk() → buffer.slice() into chunksAccumulator[]
     │              ├─ endPlayback() → combine chunks →
     │              │    └─ AudioPlayer.playFullBuffer(combined)
     │              │
     │              ├─ playFullBuffer(buf) →          ← when server returns whole buffer
     │              │    └─ AudioPlayer.playFullBuffer(buf)
     │              │
     │              ├─ waitForPlaybackEnd() → deferred promise
     │              └─ stop() → resolve deferred, clear chunks
     │
     └─ [WebSpeech: browser-native]
          │
          └─ speexSynthesize_WebSpeech()
               ├─ new SpeechSynthesisUtterance()
               └─ speechSynthesis.speak()             ← no AudioPlayer at all


AudioPlayer.playUrl(url, signal?)                 ← one-shot URL playback
│    ├─ new Audio(url)
│    ├─ audio.play()
│    ├─ onended → resolve
│    └─ signal?.abort → pause + clear src + resolve
│
├─ Telephone.tsx:130           pickup/hangup MP3s (no signal)
├─ usePlayUrlInterval.ts:20   ringtone loop (with AbortController signal)
├─ aix.client.ts:723          AI inline audio (no signal)  ← SHOULD be NB-managed
├─ Composer.tsx:372            mic-off sound (no signal)
└─ SpeexVoiceSelect.tsx:71    voice preview (with useQuery signal)


AudioPlayer.playFullBuffer(buffer, signal?)       ← one-shot buffer playback
│    ├─ new AudioContext()
│    ├─ decodeAudioData()
│    ├─ createBufferSource() → start()
│    ├─ onended → close context + resolve
│    └─ signal?.abort → stop source + close context + resolve
│
└─ AudioAutoPlayer (only caller, see above)


AudioGenerator.*()                                ← procedural Web Audio API
│    ├─ singleContext() → shared AudioContext + masterGain
│    ├─ OscillatorNode / noise buffer → GainNode → destination
│    └─ fire-and-forget, sub-500ms
│
├─ NotificationProcessor.ts   chatNotifyResponse / chatNotifyError
├─ Composer.tsx:361            chatAutoSend
├─ ChatMessage.tsx             chatAutoSend
├─ beam.scatter.ts             chatNotifyResponse (x2)
├─ beam.gather.execution.tsx   chatNotifyResponse
├─ ChatViewOptionsModal.tsx    chatNotifyResponse (x2)
├─ BeamViewOptionsModal.tsx    chatNotifyResponse
└─ NotificationProcessor.ts   basicAstralChimes (debug)
```