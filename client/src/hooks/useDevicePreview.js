import { useEffect } from 'react';
import describeDeviceSetupIssue from './describeDeviceSetupIssue';

export default function useDevicePreview({
  uiState,
  selectedCameraId,
  selectedMicId,
  isLowDataMode,
  resolution,
  frameRate,
  isVideoEnabled,
  isAudioEnabled,
  setDeviceSetupIssue,
  setCameras,
  setMics,
  setVolumeLevel,
  previewVideoRef,
  localVideoRef,
  localStreamRef,
  audioStreamRef,
  videoStreamRef,
  volumeIntervalRef,
  isJoiningRef,
  t,
}) {
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((device) => device.kind === 'videoinput'));
        setMics(devices.filter((device) => device.kind === 'audioinput'));
      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
    };

    getDevices();
    navigator.mediaDevices.ondevicechange = getDevices;

    return () => {
      navigator.mediaDevices.ondevicechange = null;
      stopPreview();
    };
  }, []);

  useEffect(() => {
    if (uiState === 'setup') {
      const timer = setTimeout(() => {
        startPreview();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopPreview();
      };
    }

    if (uiState === 'welcome') {
      stopPreview();
    }
  }, [uiState, selectedCameraId, selectedMicId, isLowDataMode]);

  const startPreview = async () => {
    try {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }

      if (!isVideoEnabled && !isAudioEnabled) {
        if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
        if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
        setVolumeLevel(0);
        return;
      }

      const constraints = {
        video: isVideoEnabled ? {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: isLowDataMode ? { ideal: 480 } : (resolution === '1080p' ? { ideal: 1920 } : (resolution === '720p' ? { ideal: 1280 } : { ideal: 640 })),
          height: isLowDataMode ? { ideal: 270 } : (resolution === '1080p' ? { ideal: 1080 } : (resolution === '720p' ? { ideal: 720 } : { ideal: 360 })),
          frameRate: isLowDataMode ? { ideal: 15 } : { ideal: frameRate },
          aspectRatio: { ideal: 1.7777777778 },
        } : false,
        audio: isAudioEnabled ? (selectedMicId ? { deviceId: { exact: selectedMicId } } : true) : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setDeviceSetupIssue(null);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoStreamRef.current = new MediaStream([videoTrack]);
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = videoStreamRef.current;
        }
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioStreamRef.current = new MediaStream([audioTrack]);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(audioStreamRef.current);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);

        volumeIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let index = 0; index < dataArray.length; index += 1) {
            sum += dataArray[index];
          }
          const average = sum / dataArray.length;
          setVolumeLevel(Math.min(100, average * 2));
        }, 100);
      }
    } catch (error) {
      console.error('Error starting preview:', error);
      setDeviceSetupIssue(describeDeviceSetupIssue(error, t));
    }
  };

  const stopPreview = () => {
    if (isJoiningRef.current) return;
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    setVolumeLevel(0);
  };

  const prepareJoinMedia = async () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    isJoiningRef.current = true;

    let stream;
    if (!isVideoEnabled && !isAudioEnabled) {
      stream = new MediaStream();
    } else {
      const constraints = {
        video: isVideoEnabled ? {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: isLowDataMode ? { ideal: 480 } : (resolution === '1080p' ? { ideal: 1920 } : (resolution === '720p' ? { ideal: 1280 } : { ideal: 640 })),
          height: isLowDataMode ? { ideal: 270 } : (resolution === '1080p' ? { ideal: 1080 } : (resolution === '720p' ? { ideal: 720 } : { ideal: 360 })),
          frameRate: isLowDataMode ? { ideal: 15 } : { ideal: frameRate },
          aspectRatio: { ideal: 1.7777777778 },
        } : false,
        audio: isAudioEnabled ? (selectedMicId ? { deviceId: { exact: selectedMicId } } : true) : false,
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        setDeviceSetupIssue(describeDeviceSetupIssue(error, t));
        throw error;
      }
    }

    setDeviceSetupIssue(null);

    stream.getTracks().forEach((track) => {
      track.enabled = true;
    });

    localStreamRef.current = stream;
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      videoStreamRef.current = new MediaStream([videoTrack]);
    }
    if (audioTrack) {
      audioStreamRef.current = new MediaStream([audioTrack]);
    }

    setTimeout(() => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }, 100);
  };

  return {
    prepareJoinMedia,
  };
}
