import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ChatMessage, getMessages, sendMessage } from "../../api/chat";
import { uploadPhoto } from "../../api/uploads";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

export default function GroupChatScreen({ route }: any) {
  const { groupId } = route.params as { groupId: string };
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", groupId],
    queryFn: () => getMessages(groupId),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ text, photoUrl }: { text?: string; photoUrl?: string }) => sendMessage(groupId, text, photoUrl),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", groupId] });
    },
  });

  const onSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate({ text: text.trim() });
  };

  const onAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      const { url } = await uploadPhoto(result.assets[0].uri);
      sendMutation.mutate({ photoUrl: url });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === profile?.id} />}
      />
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.photoButton} onPress={onAddPhoto}>
          <Text style={styles.photoButtonText}>📷</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Message the group" />
        <TouchableOpacity style={styles.sendButton} onPress={onSend} disabled={!text.trim()}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  if (message.isSystem) {
    return (
      <View style={styles.systemBubble}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, isMine && styles.bubbleMine]}>
        {!isMine && <Text style={styles.senderName}>{message.senderName}</Text>}
        {message.text && <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{message.text}</Text>}
        {message.photoUrl && <Text style={styles.photoPlaceholder}>[photo attached]</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md },
  systemBubble: { alignSelf: "center", backgroundColor: colors.border, borderRadius: 12, paddingVertical: 4, paddingHorizontal: spacing.md, marginVertical: spacing.xs },
  systemText: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  bubbleRow: { flexDirection: "row", marginVertical: spacing.xs },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm },
  bubbleMine: { backgroundColor: colors.primary, borderColor: colors.primary },
  senderName: { fontSize: 11, fontWeight: "700", color: colors.primary, marginBottom: 2 },
  messageText: { fontSize: 14, color: colors.text },
  messageTextMine: { color: "#fff" },
  photoPlaceholder: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  photoButton: { padding: spacing.sm },
  photoButtonText: { fontSize: 20 },
  input: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButton: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
