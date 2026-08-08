import { useQuery } from "@tanstack/react-query";
import { getUnreadMessages } from "../api/chat";

export function useUnreadMessages() {
  return useQuery({
    queryKey: ["unread-messages"],
    queryFn: getUnreadMessages,
    refetchInterval: 15000,
  });
}
