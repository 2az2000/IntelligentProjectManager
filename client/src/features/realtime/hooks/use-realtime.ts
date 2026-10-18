'use client';

import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  getRealtimeSocket,
  type CommentCreatedEvent,
  type CommentReactionEvent,
  type PresenceUpdateEvent,
  type TaskChangedEvent,
  type TaskPresenceEvent,
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
    // Someone reacted: refresh the thread so the chips (and their counts) are shared, not local.
    const onCommentReaction = (event: CommentReactionEvent) => {
      if (event.projectId !== projectId) return;
      void queryClient.invalidateQueries({ queryKey: qk.comments.byTask(event.taskId) });
    };

    socket.on('task:changed', onTaskChanged);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:reaction', onCommentReaction);
    return () => {
      socket.off('task:changed', onTaskChanged);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:reaction', onCommentReaction);
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

/**
 * §Imp §5 task-level presence: announces the open task and returns everyone else viewing it.
 *
 * `useProjectSocket` must already have joined the project room — the server ignores a task join
 * for a project the socket isn't in, so membership stays enforced in exactly one place.
 */
export function useTaskPresence(projectId: number, taskId: number): number[] {
  const [userIds, setUserIds] = useState<number[]>([]);

  useEffect(() => {
    if (!validId(projectId) || !validId(taskId)) return;
    const socket = getRealtimeSocket();
    if (!socket) return;

    const join = () => socket.emit('task:join', { projectId, taskId });
    const leave = () => socket.emit('task:leave', { projectId, taskId });
    const onPresence = (event: TaskPresenceEvent) => {
      if (event.projectId === projectId && event.taskId === taskId) {
        setUserIds([...event.userIds].sort((a, b) => a - b));
      }
    };

    // A reconnect loses the server-side socket id, so re-announce on every connect.
    socket.on('connect', join);
    socket.on('task:presence', onPresence);
    join();

    return () => {
      socket.off('connect', join);
      socket.off('task:presence', onPresence);
      leave();
      setUserIds([]);
    };
  }, [projectId, taskId]);

  return userIds;
}
