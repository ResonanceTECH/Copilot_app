/**
 * Утилита для отслеживания активности пользователя
 * Сохраняет данные о сообщениях на сервере через API
 * Использует localStorage как fallback при отсутствии API
 */

export interface ActivityRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

const STORAGE_KEY = 'user_activity_tracker';

/**
 * Записывает активность пользователя (отправку сообщения)
 * Активность автоматически сохраняется на сервере при отправке сообщения через API
 * Эта функция используется только для локального кэширования (fallback)
 */
export const trackActivity = (): void => {
  // Активность теперь сохраняется автоматически на сервере при отправке сообщения
  // Оставляем локальное сохранение только как fallback
  const today = new Date();
  const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const activities = getActivities();
  const existingIndex = activities.findIndex(a => a.date === dateKey);
  
  if (existingIndex >= 0) {
    activities[existingIndex].count += 1;
  } else {
    activities.push({ date: dateKey, count: 1 });
  }
  
  // Сортируем по дате
  activities.sort((a, b) => a.date.localeCompare(b.date));
  
  // Храним только последние 365 дней
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const filtered = activities.filter(a => new Date(a.date) >= oneYearAgo);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Ошибка сохранения активности:', error);
  }
};

/**
 * Получает все записи активности
 */
export const getActivities = (): ActivityRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ActivityRecord[];
    }
  } catch (error) {
    console.error('Ошибка чтения активности:', error);
  }
  return [];
};

/**
 * Получает активность за определенный период
 */
export const getActivitiesForPeriod = (
  startDate: Date,
  endDate: Date
): ActivityRecord[] => {
  const activities = getActivities();
  return activities.filter(a => {
    const date = new Date(a.date);
    return date >= startDate && date <= endDate;
  });
};

/**
 * Получает активность за день
 */
export const getActivitiesForDay = (date: Date): ActivityRecord[] => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return getActivitiesForPeriod(startOfDay, endOfDay);
};

/**
 * Получает активность за неделю
 */
export const getActivitiesForWeek = (date: Date): ActivityRecord[] => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(date);
  endOfWeek.setHours(23, 59, 59, 999);
  return getActivitiesForPeriod(startOfWeek, endOfWeek);
};

/**
 * Получает активность за месяц
 */
export const getActivitiesForMonth = (date: Date): ActivityRecord[] => {
  const startOfMonth = new Date(date);
  startOfMonth.setDate(date.getDate() - 29);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(date);
  endOfMonth.setHours(23, 59, 59, 999);
  return getActivitiesForPeriod(startOfMonth, endOfMonth);
};

/**
 * Получает активность за последний год (для contribution graph)
 */
export const getActivitiesForYear = (): ActivityRecord[] => {
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const today = new Date();
  return getActivitiesForPeriod(oneYearAgo, today);
};

/**
 * Загружает данные активности с сервера
 */
export const loadActivitiesFromAPI = async (
  period: 'day' | 'week' | 'month' | 'year' = 'year'
): Promise<ActivityRecord[]> => {
  try {
    const { chatAPI } = await import('./api');
    const response = await chatAPI.getEfficiencyData(period);
    return response.activities;
  } catch (error) {
    console.error('Ошибка загрузки активности с сервера:', error);
    // Fallback на локальные данные
    const today = new Date();
    if (period === 'day') {
      return getActivitiesForDay(today);
    } else if (period === 'week') {
      return getActivitiesForWeek(today);
    } else if (period === 'month') {
      return getActivitiesForMonth(today);
    } else {
      return getActivitiesForYear();
    }
  }
};

