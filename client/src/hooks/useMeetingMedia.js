import useDevicePreview from './useDevicePreview';
import useInMeetingMedia from './useInMeetingMedia';

export default function useMeetingMedia(config) {
  const devicePreview = useDevicePreview(config);
  const meetingMedia = useInMeetingMedia(config);

  return {
    ...devicePreview,
    ...meetingMedia,
  };
}
