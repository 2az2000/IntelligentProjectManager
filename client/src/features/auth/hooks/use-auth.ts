import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { authApi, type LoginInput, type RegisterInput } from '../api/auth.api';

export function useCurrentUser() {
  return useQuery({ queryKey: qk.auth.me, queryFn: authApi.me, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (user) => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== qk.auth.me[0] });
      queryClient.setQueryData(qk.auth.me, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (user) => queryClient.setQueryData(qk.auth.me, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(qk.auth.me, null);
    },
  });
}
