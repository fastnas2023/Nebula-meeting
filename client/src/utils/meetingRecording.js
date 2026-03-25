function clearRecordingTimer(recordingStatsIntervalRef) {
  if (recordingStatsIntervalRef.current) {
    clearInterval(recordingStatsIntervalRef.current);
    recordingStatsIntervalRef.current = null;
  }
}

function startRecordingTimer(recordingStatsIntervalRef, setRecordingStats) {
  clearRecordingTimer(recordingStatsIntervalRef);
  recordingStatsIntervalRef.current = setInterval(() => {
    setRecordingStats((prev) => ({ ...prev, seconds: prev.seconds + 1 }));
  }, 1000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  anchor.remove();
}

function finalizeRecording({
  recorder,
  recordedChunksRef,
  setIsRecording,
  setIsRecordModeOpen,
  recordingStatsIntervalRef,
  recordingStopCleanupRef,
  addToast,
  successMessage,
  filename,
}) {
  const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
  downloadBlob(blob, filename);
  recordedChunksRef.current = [];
  setIsRecording(false);
  setIsRecordModeOpen(false);
  clearRecordingTimer(recordingStatsIntervalRef);
  if (recordingStopCleanupRef.current) {
    recordingStopCleanupRef.current();
    recordingStopCleanupRef.current = null;
  }
  addToast(successMessage, 'success');
}

function pickSupportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch (error) {
      void error;
    }
  }

  return '';
}

export function formatRecordingStats(seconds, bytes) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(remainingSeconds).padStart(2, '0');
  const mb = bytes / (1024 * 1024);
  const size = mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(0, Math.round(bytes / 1024))}KB`;
  return { time: `${mm}:${ss}`, size };
}

export function stopMediaRecording(mediaRecorderRef) {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop();
  }
  try {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  } catch (error) {
    void error;
  }
}

export async function startDisplayRecording({
  mediaRecorderRef,
  recordedChunksRef,
  recordingStatsIntervalRef,
  recordingStopCleanupRef,
  setRecordingStats,
  setIsRecording,
  setIsRecordModeOpen,
  addToast,
  startedMessage,
  savedMessage,
  errorMessage,
  onStopRequested,
}) {
  try {
    setIsRecordModeOpen(false);
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recordedChunksRef.current = [];
    setRecordingStats({ seconds: 0, bytes: 0 });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
        setRecordingStats((prev) => ({ ...prev, bytes: prev.bytes + event.data.size }));
      }
    };

    recorder.onstop = () => {
      finalizeRecording({
        recorder,
        recordedChunksRef,
        setIsRecording,
        setIsRecordModeOpen,
        recordingStatsIntervalRef,
        recordingStopCleanupRef,
        addToast,
        successMessage: savedMessage,
        filename: `meeting-recording-${Date.now()}.webm`,
      });
    };

    recorder.start(1000);
    setIsRecording(true);
    addToast(startedMessage, 'success');
    startRecordingTimer(recordingStatsIntervalRef, setRecordingStats);

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        onStopRequested();
      };
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    addToast(errorMessage, 'error');
  }
}

export async function startCompositeRecordingSession({
  tileIds,
  getStreamById,
  mediaRecorderRef,
  recordedChunksRef,
  recordingStatsIntervalRef,
  recordingStopCleanupRef,
  setRecordingStats,
  setIsRecording,
  setIsRecordModeOpen,
  addToast,
  startedMessage,
  savedMessage,
  errorMessage,
}) {
  setIsRecordModeOpen(false);

  const videos = new Map();
  const cleanupVideos = () => {
    for (const video of videos.values()) {
      try {
        video.pause();
      } catch (error) {
        void error;
      }
      try {
        video.srcObject = null;
      } catch (error) {
        void error;
      }
      try {
        video.remove();
      } catch (error) {
        void error;
      }
    }
    videos.clear();
  };

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    addToast(errorMessage, 'error');
    return;
  }

  const ensureVideo = async (id, stream) => {
    if (!stream) return null;
    if (videos.has(id)) return videos.get(id);

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.style.position = 'fixed';
    video.style.left = '-99999px';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.srcObject = stream;
    document.body.appendChild(video);

    await new Promise((resolve) => {
      const done = () => resolve();
      if (video.readyState >= 2) return done();
      video.onloadedmetadata = done;
      video.oncanplay = done;
    });

    try {
      await video.play();
    } catch (error) {
      void error;
    }

    videos.set(id, video);
    return video;
  };

  for (const id of tileIds) {
    await ensureVideo(id, getStreamById(id));
  }

  const capture = canvas.captureStream(30);

  let audioContext = null;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioContext = new AudioCtor();
      const audioDestination = audioContext.createMediaStreamDestination();
      tileIds.forEach((id) => {
        const stream = getStreamById(id);
        if (!stream || stream.getAudioTracks().length === 0) return;
        try {
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(audioDestination);
        } catch (error) {
          void error;
        }
      });
      audioDestination.stream.getAudioTracks().forEach((track) => capture.addTrack(track));
    }
  } catch (error) {
    void error;
  }

  const mimeType = pickSupportedMimeType();
  const recorder = mimeType ? new MediaRecorder(capture, { mimeType }) : new MediaRecorder(capture);
  mediaRecorderRef.current = recorder;
  recordedChunksRef.current = [];
  setRecordingStats({ seconds: 0, bytes: 0 });

  const drawContain = (video, x, y, width, height) => {
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const scale = Math.min(width / vw, height / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = x + (width - dw) / 2;
    const dy = y + (height - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);
  };

  let animationFrame = 0;
  const render = () => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const count = tileIds.length;
    const cols = count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const pad = 8;
    const cellW = (canvas.width - pad * (cols + 1)) / cols;
    const cellH = (canvas.height - pad * (rows + 1)) / rows;

    tileIds.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = pad + col * (cellW + pad);
      const y = pad + row * (cellH + pad);
      const video = videos.get(id);
      if (video && video.readyState >= 2) {
        drawContain(video, x, y, cellW, cellH);
      }
    });

    animationFrame = requestAnimationFrame(render);
  };
  render();

  recordingStopCleanupRef.current = () => {
    try {
      cancelAnimationFrame(animationFrame);
    } catch (error) {
      void error;
    }
    try {
      capture.getTracks().forEach((track) => track.stop());
    } catch (error) {
      void error;
    }
    try {
      if (audioContext) audioContext.close();
    } catch (error) {
      void error;
    }
    cleanupVideos();
    try {
      canvas.remove();
    } catch (error) {
      void error;
    }
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunksRef.current.push(event.data);
      setRecordingStats((prev) => ({ ...prev, bytes: prev.bytes + event.data.size }));
    }
  };

  recorder.onstop = () => {
    finalizeRecording({
      recorder,
      recordedChunksRef,
      setIsRecording,
      setIsRecordModeOpen,
      recordingStatsIntervalRef,
      recordingStopCleanupRef,
      addToast,
      successMessage: savedMessage,
      filename: `meeting-composite-${Date.now()}.webm`,
    });
  };

  recorder.start(1000);
  setIsRecording(true);
  addToast(startedMessage, 'success');
  startRecordingTimer(recordingStatsIntervalRef, setRecordingStats);
}
