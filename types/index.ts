export interface User { id: string; name: string; avatarUrl: string; }
export interface Memory { id: string; title: string; date: string; imageUrl?: string; }
export interface Message { id: string; senderId: string; content: string; timestamp: string; }
export interface AppData {
  currentUser: User;
  partnerUser: User;
  relationshipStartDate: string;
  latestMemory: Memory;
  latestMessage: Message;
}
