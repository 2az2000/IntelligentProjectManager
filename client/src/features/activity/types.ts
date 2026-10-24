/**
 * Activity rows are shared with the server (`@managesys/contracts`): one page is at most
 * `ACTIVITY_PAGE_SIZE` rows and `nextCursor` drives the "load more" button.
 */
export {
  ACTIVITY_ACTIONS,
  ACTIVITY_MAX_PAGE_SIZE,
  ACTIVITY_PAGE_SIZE,
  type ActivityAction,
  type ActivityActor,
  type ActivityEntry,
  type ActivityPage,
} from '@managesys/contracts';
