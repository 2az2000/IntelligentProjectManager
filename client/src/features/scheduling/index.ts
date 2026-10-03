export { ProjectTimeline } from './components/project-timeline';
export { DependenciesSection } from './components/dependencies-section';
export { PredictedFinishBadge } from './components/predicted-finish-badge';
export {
  useSchedule,
  useTaskSchedule,
  useApplySchedule,
  useDependencies,
  useCreateDependency,
  useDeleteDependency,
} from './hooks/use-schedule';
export type { ScheduledTask, ScheduleResult, DependencyView, DependencyType } from './types';
export { DEPENDENCY_TYPES } from './types';
