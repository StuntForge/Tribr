import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

  // useAnimatedKeyboard reads the real native inset for the keyboard (via
  // Reanimated's own bridge, not RN's legacy Keyboard module), which is what
  // actually stays reliable on edge-to-edge Android (mandatory since Android
  // 15) - the plain `Keyboard.addListener` approach tried before this did
  // not. insets.bottom is added on top permanently (not just while the
  // keyboard is up) because the tab bar - which used to be what kept this
  // screen's content clear of the on-screen Android nav buttons - is hidden
  // while chatting, so nothing else reserves that space anymore.
  const keyboard = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value + insets.bottom,
  }));

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", groupId],
    queryFn: () => getMessages(groupId),
    refetchInterval: 5000,
  });

  // Fetching this list marks it read server-side, but the Tribes tab badge
  // reads a separate, 15s-polled query - without this it can sit there for
  // up to 15s after the chat's already been seen. Refetching it here as
  // soon as we know we're caught up makes it clear instantly instead.
  useEffect(() => {
    if (messages) queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
  }, [messages, queryClient]);

  const sendMutation = useMutation({
    mutationFn: ({ text, photoUrl }: { text?: string; photoUrl?: string }) => sendMessage(groupId, text, photoUrl),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["messages", groupId] });
    },
  });

  const onSend = () => {
    if (!text.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ text: text.trim() });
  };

  const onAddPhoto = async () => {
    if (sendMutation.isPending) return;
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
    <Animated.View style={[styles.container, animatedStyle]}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hello, or wait for the Tribe leader to get things moving.</Text>
          </View>
        }
        renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === profile?.id} />}
      />
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[styles.photoButton, sendMutation.isPending && styles.buttonDisabled]}
          onPress={onAddPhoto}
          disabled={sendMutation.isPending}
          accessibilityLabel="Attach a photo"
          accessibilityRole="button"
        >
          <Text style={styles.photoButtonText}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message the Tribe"
          accessibilityLabel="Message the Tribe"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || sendMutation.isPending) && styles.buttonDisabled]}
          onPress={onSend}
          disabled={!text.trim() || sendMutation.isPending}
          accessibilityRole="button"
        >
          {sendMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
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
  list: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  photoButton: { padding: spacing.sm },
  photoButtonText: { fontSize: 20 },
  input: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButton: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
});
