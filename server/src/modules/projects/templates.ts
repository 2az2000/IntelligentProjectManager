/**
 * §11 built-in project templates: "start without a blank page". The client sends
 * these tasks (and the finish-to-start edges) through the normal task/dependency
 * endpoints after the project is created, so permissions, fractional ordering,
 * activity and realtime all behave exactly like manual creation — no special code.
 */
export interface TemplateTask {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimateHours?: number;
  /** Titles of tasks that must finish before this one starts. */
  dependsOn?: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tasks: TemplateTask[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'software-launch',
    name: 'راه‌اندازی محصول نرم‌افزاری',
    nameEn: 'Software product launch',
    description: 'از طراحی تا انتشار: ۶ فاز کلاسیک با وابستگی‌های آماده.',
    tasks: [
      { title: 'طراحی وایرفریم', priority: 'HIGH', estimateHours: 16 },
      { title: 'پیاده‌سازی فرانت‌اند', priority: 'HIGH', estimateHours: 60, dependsOn: ['طراحی وایرفریم'] },
      { title: 'پیاده‌سازی بک‌اند', priority: 'HIGH', estimateHours: 80 },
      { title: 'یکپارچه‌سازی و تست', priority: 'MEDIUM', estimateHours: 32, dependsOn: ['پیاده‌سازی فرانت‌اند', 'پیاده‌سازی بک‌اند'] },
      { title: 'محتوای مارکتینگ', priority: 'MEDIUM', estimateHours: 24 },
      { title: 'انتشار نسخه‌ی اول', priority: 'URGENT', estimateHours: 8, dependsOn: ['یکپارچه‌سازی و تست', 'محتوای مارکتینگ'] },
    ],
  },
  {
    id: 'campaign',
    name: 'کمپین بازاریابی',
    nameEn: 'Marketing campaign',
    description: 'برنامه‌ریزی کمپین: استراتژی، تولید محتوا، اجرا و گزارش.',
    tasks: [
      { title: 'استراتژی و پیام کمپین', priority: 'HIGH', estimateHours: 12 },
      { title: 'تولید محتوا (متن و تصویر)', priority: 'HIGH', estimateHours: 24, dependsOn: ['استراتژی و پیام کمپین'] },
      { title: 'طراحی لندینگ', priority: 'MEDIUM', estimateHours: 16, dependsOn: ['استراتژی و پیام کمپین'] },
      { title: 'اجرای تبلیغات', priority: 'HIGH', estimateHours: 8, dependsOn: ['تولید محتوا (متن و تصویر)', 'طراحی لندینگ'] },
      { title: 'گزارش عملکرد', priority: 'LOW', estimateHours: 6, dependsOn: ['اجرای تبلیغات'] },
    ],
  },
  {
    id: 'event',
    name: 'برگزاری رویداد',
    nameEn: 'Event organization',
    description: 'رویداد حضوری: مکان، مهمانان، لجستیک و روز اجرا.',
    tasks: [
      { title: 'رزرو مکان و تاریخ', priority: 'URGENT', estimateHours: 6 },
      { title: 'دعوت سخنرانان و مهمانان', priority: 'HIGH', estimateHours: 14, dependsOn: ['رزرو مکان و تاریخ'] },
      { title: 'هماهنگی پذیرایی و لجستیک', priority: 'MEDIUM', estimateHours: 10 },
      { title: 'بازتاب رسانه‌ای', priority: 'LOW', estimateHours: 8, dependsOn: ['دعوت سخنرانان و مهمانان'] },
    ],
  },
];

export const findTemplate = (id: string): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find((t) => t.id === id);
