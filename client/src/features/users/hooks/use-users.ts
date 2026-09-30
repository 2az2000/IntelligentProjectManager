import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { userApi, type ProfileInput } from '../api/user.api';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Debounced people search (for inviting members). Needs at least 2 characters. */
export function useUserSearch(query: string) {
  const term = useDebounced(query.trim());
  return useQuery({
    queryKey: qk.users.search(term),
    queryFn: () => userApi.search(term),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => userApi.updateMe(input),
    onSuccess: (user) => {
      queryClient.setQueryData(qk.auth.me, user);
      // Names/avatars appear on tasks, members and comments.
      return queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== qk.auth.me[0],
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: userApi.changePassword });
}
