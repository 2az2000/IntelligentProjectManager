import { describe, expect, it } from 'vitest';
import type { ScheduleEdge, ScheduleTask } from '../application/schedule';
import { buildDeadlinePlan, workingDays, workingHoursBetween } from './deadline-plan';
import { HolidayCalendar } from './holidays';

/** Local-time constructors keep the hour-by-hour math independent of the runner's timezone. */
const local = (day: number, hour = 0) => new Date(2026, 0, day, hour, 0, 0, 0);
const noWeekend = new Set<number>();
const noHolidays = new HolidayCalendar([]);

const task = (id: number, estimateHours: number | null, status: ScheduleTask['status'] = 'TODO'): ScheduleTask => ({
  id,
  title: `Task ${id}`,
  status,
  estimateHours,
  startDate: null,
  dueDate: null,
});

const baseInput = {
  anchor: local(5),
  weekend: noWeekend,
  holidays: noHolidays,
};

describe('workingHoursBetween', () => {
  it('counts only working hours and never goes negative', () => {
    expect(workingHoursBetween(local(5), local(5, 8), noWeekend, noHolidays)).toBe(8);
    expect(workingHoursBetween(local(5, 8), local(5), noWeekend, noHolidays)).toBe(0);
    expect(workingHoursBetween(local(5), local(5), noWeekend, noHolidays)).toBe(0);
  });

  it('skips weekend days and official holidays', () => {
    // 2026-01-09 is a Friday, 2026-01-10 a Saturday: both in the weekend set.
    expect(workingHoursBetween(local(9), local(11), new Set([5, 6]), noHolidays)).toBe(0);

    const calendar = new HolidayCalendar([{ date: local(12), title: 'Holiday', isRecurring: false }]);
    expect(workingHoursBetween(local(12), local(13), noWeekend, calendar)).toBe(0);
    // The same day next year is not a holiday (dated, not recurring).
    const nextYear = new Date(2027, 0, 12, 0, 0, 0, 0);
    expect(workingHoursBetween(nextYear, new Date(2027, 0, 12, 8, 0, 0, 0), noWeekend, calendar)).toBe(8);
  });

  it('converts a buffer in hours to a readable working-day figure', () => {
    expect(workingDays(0)).toBe(0);
    expect(workingDays(8)).toBe(1);
    expect(workingDays(-20)).toBe(-2.5);
  });
});

describe('buildDeadlinePlan', () => {
  const tasks = [task(1, 8), task(2, 8)];
  const deps: ScheduleEdge[] = [{ predecessorId: 1, successorId: 2 }];

  it('shifts every CPM node by the deadline buffer when the plan is feasible', () => {
    // Five calendar days (120 working hours) against 16 hours of effort.
    const plan = buildDeadlinePlan({
      ...baseInput,
      tasks,
      deps,
      deadline: local(10),
      requiredHours: 16,
      confidence: 85,
    });

    expect(plan.feasible).toBe(true);
    expect(plan.availableHours).toBe(120);
    expect(plan.projectDurationHours).toBe(16);
    expect(plan.bufferHours).toBe(104);
    expect(plan.bufferWorkingDays).toBe(13);
    expect(plan.mustStartNow).toEqual([]);
    expect(plan.unestimatedTaskIds).toEqual([]);
    expect(plan.tasks.map((t) => t.taskId)).toEqual([1, 2]);
    expect(plan.tasks[0]).toMatchObject({
      latestStart: local(9, 8).toISOString(),
      latestFinish: local(9, 16).toISOString(),
      slackHours: 104,
      isCritical: true,
      mustStartNow: false,
    });
    // The successor inherits its predecessor's offset: 8h earliest start + 104h buffer.
    expect(plan.tasks[1]).toMatchObject({
      latestStart: local(9, 16).toISOString(),
      latestFinish: local(10, 0).toISOString(),
      slackHours: 112,
      isCritical: true,
    });
  });

  it('reports an unattainable deadline instead of hiding the negative buffer', () => {
    const plan = buildDeadlinePlan({
      ...baseInput,
      tasks,
      deps,
      deadline: local(6),
      requiredHours: 40,
      confidence: 95,
    });

    expect(plan.feasible).toBe(false);
    expect(plan.availableHours).toBe(24);
    expect(plan.bufferHours).toBe(-16);
    expect(plan.bufferWorkingDays).toBe(-2);
    expect(plan.confidence).toBe(95);
    // Both tasks are already behind the plan; their latest start is the anchor.
    expect(plan.mustStartNow).toEqual([1, 2]);
    expect(plan.tasks[0]!.slackHours).toBe(-16);
    expect(plan.tasks[1]!.slackHours).toBe(-8);
    expect(plan.tasks[0]!.latestStart).toBe(baseInput.anchor.toISOString());
  });

  it('keeps finished and unestimated tasks out of the plan without dropping their ids', () => {
    const plan = buildDeadlinePlan({
      ...baseInput,
      tasks: [task(1, 8), task(2, null), task(3, 8, 'DONE')],
      deps: [],
      deadline: local(10),
      requiredHours: 8,
      confidence: 50,
    });

    expect(plan.tasks.map((t) => t.taskId)).toEqual([1]);
    expect(plan.unestimatedTaskIds).toEqual([2]);
    expect(plan.projectDurationHours).toBe(8);
  });

  it('moves weekend and holiday work onto the next working day', () => {
    const calendar = new HolidayCalendar([{ date: local(6), title: 'Holiday', isRecurring: false }]);
    const plan = buildDeadlinePlan({
      ...baseInput,
      tasks: [task(1, 8)],
      deps: [],
      deadline: local(10),
      requiredHours: 8,
      confidence: 50,
      // 2026-01-06 (holiday) and 07-08... the window still leaves enough hours.
      holidays: calendar,
    });

    expect(plan.feasible).toBe(true);
    // The latest start skips the holiday at 00:00 on the 6th.
    expect(new Date(plan.tasks[0]!.latestStart!).getDate()).not.toBe(6);
  });
});
