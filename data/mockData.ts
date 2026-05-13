import { AppData } from '../types';

export const mockData: AppData = {
  currentUser: { id: '1', name: 'Alejandro', avatarUrl: 'https://i.pravatar.cc/150?u=alejandro' },
  partnerUser: { id: '2', name: 'Sofia', avatarUrl: 'https://i.pravatar.cc/150?u=sofia' },
  relationshipStartDate: '2023-01-10T00:00:00Z',
  latestMemory: { id: 'm1', title: 'Viaje a la playa', date: 'Hace 2 dÃ­as' },
  latestMessage: { id: 'msg1', senderId: '2', content: 'Te amo muchÃ­simo â¤ï¸', timestamp: 'Hace 5 min' },
};
