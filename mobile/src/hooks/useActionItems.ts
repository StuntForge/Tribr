import { useQuery } from "@tanstack/react-query";
import { getActionItems } from "../api/notifications";

export function useActionItems() {
  return useQuery({
    queryKey: ["action-items"],
    queryFn: getActionItems,
    refetchInterval: 15000,
  });
}
