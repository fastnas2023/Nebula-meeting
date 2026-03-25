export default function describeDeviceSetupIssue(error, t) {
  if (!error) {
    return {
      reason: 'unknown',
      title: t('device_setup_issue_title') || 'Device access failed',
      message: t('device_access_error'),
      fixes: [],
    };
  }

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return {
      reason: 'permissionDenied',
      title: t('device_permission_denied_title') || 'Camera or microphone permission is blocked',
      message: t('device_permission_denied_message') || 'Your browser denied access to camera or microphone.',
      fixes: [
        t('device_fix_allow_permission') || 'Allow camera and microphone in the browser permission prompt.',
        t('device_fix_check_site_settings') || 'Open browser site settings and re-enable camera/microphone access.',
      ],
    };
  }

  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return {
      reason: 'deviceNotFound',
      title: t('device_not_found_title') || 'No usable camera or microphone was found',
      message: t('device_not_found_message') || 'The selected camera or microphone is not available right now.',
      fixes: [
        t('device_fix_reconnect') || 'Reconnect the device and reopen this page.',
        t('device_fix_switch_device') || 'Choose another camera or microphone from the device list.',
      ],
    };
  }

  if (error.name === 'SecurityError' || (typeof window !== 'undefined' && window.location.protocol !== 'https:')) {
    return {
      reason: 'httpsRequired',
      title: t('https_required_title') || 'Secure context required',
      message: t('https_required_message') || 'Camera and microphone access usually requires HTTPS or localhost.',
      fixes: [
        t('https_fix_secure_origin') || 'Open the meeting from an HTTPS address or localhost.',
      ],
    };
  }

  return {
    reason: 'unknown',
    title: t('device_setup_issue_title') || 'Device access failed',
    message: error.message || t('device_access_error'),
    fixes: [
      t('device_fix_retry') || 'Check whether another app is using your camera or microphone, then try again.',
    ],
  };
}
