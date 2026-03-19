export function getRoomIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const roomId = params.get('roomId');
  return roomId && roomId.trim() ? roomId : null;
}

export function removeRoomIdFromHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('roomId');
  return url.toString();
}

