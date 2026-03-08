import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChatMessages, useChatRealtime, useSendMessage, useMarkConversationRead, Conversation } from '@/hooks/useChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, ImagePlus, Paperclip, Loader2, Plus, X, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props {
  conversation: Conversation;
  onBack: () => void;
}

export const ChatScreen = memo(function ChatScreen({ conversation, onBack }: Props) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useChatMessages(conversation.id);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // Realtime subscription
  useChatRealtime(conversation.id);

  // Mark as read on mount
  useEffect(() => {
    markRead.mutate(conversation.id);
  }, [conversation.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    sendMessage.mutate({ conversationId: conversation.id, content: text.trim() });
    setText('');
  }, [text, conversation.id, sendMessage]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('tenant-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        messageType: type,
        fileUrl: data.publicUrl,
        fileName: file.name,
      });
    } catch {
      // ignore
    }
    setUploading(false);
    setShowAttach(false);
  }, [user?.id, conversation.id, sendMessage]);

  const chatName = conversation.type === 'group' ? conversation.name : conversation.other_user_name;
  const chatAvatar = conversation.type === 'group' ? conversation.avatar_url : conversation.other_user_avatar;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src={chatAvatar || undefined} />
          <AvatarFallback className="text-sm">{(chatName || 'U')[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{chatName}</p>
          <p className="text-[10px] text-muted-foreground">Đang hoạt động</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Đang tải tin nhắn...</div>
        ) : !messages?.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Hãy gửi tin nhắn đầu tiên!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMine = msg.sender_id === user?.id;
            const showAvatar = !isMine && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
            return (
              <div key={msg.id} className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
                {!isMine && showAvatar ? (
                  <Avatar className="h-7 w-7 shrink-0 mt-auto">
                    <AvatarImage src={msg.sender_avatar || undefined} />
                    <AvatarFallback className="text-[10px]">{(msg.sender_name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                ) : !isMine ? <div className="w-7" /> : null}
                <div className={cn('max-w-[75%]')}>
                  {msg.message_type === 'image' && msg.file_url ? (
                    <img src={msg.file_url} alt="" className="rounded-xl max-w-full max-h-60 object-cover" />
                  ) : msg.message_type === 'file' && msg.file_url ? (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                      className={cn('block px-3 py-2 rounded-2xl text-sm underline',
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      📎 {msg.file_name || 'Tệp đính kèm'}
                    </a>
                  ) : (
                    <div className={cn(
                      'px-3 py-2 rounded-2xl text-sm',
                      isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                    )}>
                      {msg.content}
                    </div>
                  )}
                  <p className={cn('text-[9px] text-muted-foreground mt-0.5', isMine ? 'text-right' : 'text-left')}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: vi })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment menu */}
      {showAttach && (
        <div className="flex gap-3 px-3 py-2 border-t bg-muted/50">
          <button onClick={() => imageRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ImagePlus className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-[10px]">Ảnh</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Paperclip className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-[10px]">Tệp</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors opacity-50">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-[10px]">Vị trí</span>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t bg-background shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowAttach(!showAttach)}>
          {showAttach ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </Button>
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="h-9 flex-1"
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-primary" onClick={handleSend} disabled={!text.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        )}
      </div>

      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'image')} />
      <input ref={fileRef} type="file" className="hidden" onChange={e => handleFileUpload(e, 'file')} />
    </div>
  );
});
