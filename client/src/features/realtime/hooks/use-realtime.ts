'use client';

import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  getRealtimeSocket,
  type CommentCreatedEvent,
  type PresenceUpdateEvent,
  type TaskChangedEvent,
} from '../socket';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

function invalidateTaskViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard }),
    queryClient.invalidateQueries({ queryKey: qk.projects.all }),
    queryClient.invalidateQueries({ queryKey: qk.team }),
    queryClient.invalidateQueries({ queryKey: qk.schedule.all }),
    queryClient.invalidateQueries({ queryKey: qk.dependencies.all }),
  ]);
}

/**
 * Live updates for one project's room: joins the room and refreshes every
 * task-derived query whenever someone (us included — the server is the source
 * of truth) creates, edits, moves or deletes a task or writes a comment.
 */
export function useProjectSocket(projectId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!validId(projectId)) return;
    const socket = getRealtimeSocket();
    if (!socket) return;

    socket.emit('project:join', projectId);

    const onTaskChanged = (event: TaskChangedEvent) => {
      if (event.projectId !== projectId) return;
      void invalidateTaskViews(queryClient);
    };
    const onCommentCreated = (event: CommentCreatedEvent) => {
      if (event.projectId !== projectId) return;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.comments.byTask(event.taskId) }),
        queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
      ]);
    };

    socket.on('task:changed', onTaskChanged);
    socket.on('comment:created', onCommentCreated);
    return () => {
      socket.off('task:changed', onTaskChanged);
      socket.off('comment:created', onCommentCreated);
    };
  }, [projectId, queryClient]);
}

/**
 * Who is online in this project's room. Requires `useProjectSocket` (or any
 * other join) so the server actually puts us in the room.
 */
export function useProjectPresence(projectId: number): number[] {
  const [userIds, setUserIds] = useState<number[]>([]);

  useEffect(() => {
    if (!validId(projectId)) return;
    const socket = getRealtimeSocket();
    if (!socket) return;

    const onPresence = (event: PresenceUpdateEvent) => {
      if (event.projectId === projectId) setUserIds([...event.userIds].sort((a, b) => a - b));
    };

    socket.on('presence:update', onPresence);
    return () => {
      socket.off('presence:update', onPresence);
    };
  }, [projectId]);

  return userIds;
}
