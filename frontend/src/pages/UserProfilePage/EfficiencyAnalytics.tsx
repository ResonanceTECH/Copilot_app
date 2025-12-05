import React, { useState, useEffect, useMemo } from 'react';
import {
  loadActivitiesFromAPI,
} from '../../utils/activityTracker';
import './EfficiencyAnalytics.css';

type Period = 'day' | 'week' | 'month' | 'year';

interface ActivityData {
  date: string;
  count: number;
}

export const EfficiencyAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<Period>('year');
  const [activityData, setActivityData] = useState<ActivityData[]>([]);

  // Загружаем данные активности с сервера
  useEffect(() => {
    const loadActivityData = async (period: Period): Promise<void> => {
      try {
        const records = await loadActivitiesFromAPI(period);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (period === 'day') {
          // Данные по часам за сегодня
          const hourData: ActivityData[] = [];
          const todayKey = today.toISOString().split('T')[0];
          const todayRecord = records.find(r => r.date === todayKey);
          const totalCount = todayRecord?.count || 0;
          
          // Распределяем активность по часам (для демонстрации)
          for (let i = 23; i >= 0; i--) {
            const date = new Date(today);
            date.setHours(i, 0, 0, 0);
            hourData.push({
              date: date.toISOString(),
              count: i >= 20 && i <= 22 ? Math.floor(totalCount / 3) : Math.floor(Math.random() * totalCount / 10),
            });
          }
          setActivityData(hourData);
        } else if (period === 'week') {
          // Заполняем все 7 дней недели
          const weekData: ActivityData[] = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const record = records.find(r => r.date === dateKey);
            weekData.push({
              date: dateKey,
              count: record?.count || 0,
            });
          }
          setActivityData(weekData);
        } else if (period === 'month') {
          // Заполняем все 30 дней месяца
          const monthData: ActivityData[] = [];
          for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const record = records.find(r => r.date === dateKey);
            monthData.push({
              date: dateKey,
              count: record?.count || 0,
            });
          }
          setActivityData(monthData);
        } else {
          // Для года используем данные как есть (они уже обработаны в groupedByWeek)
          const data = records.map(r => ({
            date: r.date,
            count: r.count,
          }));
          setActivityData(data);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных активности:', error);
        setActivityData([]);
      }
    };

    loadActivityData(period);
  }, [period]);

  const maxCount = useMemo(() => {
    return Math.max(...activityData.map(d => d.count), 1);
  }, [activityData]);

  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    if (count <= maxCount * 0.25) return 1;
    if (count <= maxCount * 0.5) return 2;
    if (count <= maxCount * 0.75) return 3;
    return 4;
  };

  const formatDate = (dateString: string, period: Period): string => {
    const date = new Date(dateString);
    if (period === 'day') {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // Группируем данные по неделям для годового графика (как в GitHub)
  const { groupedByWeek, monthLabels } = useMemo(() => {
    if (period !== 'year') return { groupedByWeek: null, monthLabels: [] };
    
    const today = new Date();
    const weeks: ActivityData[][] = [];
    const months: { [key: string]: number } = {}; // Месяц -> индекс первой недели
    
    // Находим начало года (52 недели назад, начиная с понедельника)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (51 * 7));
    // Находим понедельник этой недели
    const dayOfWeek = startDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Понедельник = 1
    startDate.setDate(startDate.getDate() + diff);
    startDate.setHours(0, 0, 0, 0);
    
    // Создаем структуру для последних 52 недель (каждая неделя - массив из 7 дней)
    for (let weekIndex = 0; weekIndex < 52; weekIndex++) {
      const week: ActivityData[] = [];
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (weekIndex * 7));
      
      // Отслеживаем начало месяцев (только первая неделя месяца)
      const monthKey = weekStart.toLocaleDateString('ru-RU', { month: 'short' });
      const isFirstWeekOfMonth = weekStart.getDate() <= 7;
      if (isFirstWeekOfMonth && !months[monthKey]) {
        months[monthKey] = weekIndex;
      }
      
      // Для каждой недели создаем 7 дней (понедельник = 0, вторник = 1, ..., воскресенье = 6)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateKey = date.toISOString().split('T')[0];
        
        // Ищем данные для этого дня
        const dayData = activityData.find(a => a.date === dateKey);
        week.push(dayData || { date: dateKey, count: 0 });
      }
      
      weeks.push(week);
    }
    
    // Создаем массив меток месяцев
    const monthLabelsArray = Object.entries(months)
      .sort((a, b) => a[1] - b[1])
      .map(([month, weekIndex]) => ({ month, weekIndex }));
    
    return { groupedByWeek: weeks, monthLabels: monthLabelsArray };
  }, [activityData, period]);

  const getTotalActivity = (): number => {
    return activityData.reduce((sum, item) => sum + item.count, 0);
  };

  const getAverageActivity = (): number => {
    return activityData.length > 0 ? Math.round(getTotalActivity() / activityData.length) : 0;
  };

  // Данные для линейного графика
  const lineChartData = useMemo(() => {
    return activityData.map((item, index) => ({
      x: index,
      y: item.count,
      date: item.date,
    }));
  }, [activityData]);

  // Данные для столбчатой диаграммы (группировка по дням недели для недели/месяца)
  const barChartData = useMemo(() => {
    if (period === 'week' || period === 'month') {
      const dayOfWeekStats: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const dayOfWeekCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      activityData.forEach(item => {
        const date = new Date(item.date);
        const dayOfWeek = date.getDay();
        dayOfWeekStats[dayOfWeek] += item.count;
        dayOfWeekCounts[dayOfWeek] += 1;
      });

      const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return [0, 1, 2, 3, 4, 5, 6].map(day => ({
        day,
        label: dayNames[day],
        value: dayOfWeekCounts[day] > 0 ? Math.round(dayOfWeekStats[day] / dayOfWeekCounts[day]) : 0,
      }));
    }
    return [];
  }, [activityData, period]);

  // Максимальное значение для масштабирования графиков
  const maxValue = useMemo(() => {
    return Math.max(...activityData.map(d => d.count), 1);
  }, [activityData]);

  // Максимальное значение для столбчатой диаграммы
  const maxBarValue = useMemo(() => {
    if (barChartData.length > 0) {
      return Math.max(...barChartData.map(d => d.value), 1);
    }
    return maxValue;
  }, [barChartData, maxValue]);

  // Пики активности по часам (для дневного периода)
  const peakHours = useMemo(() => {
    if (period !== 'day' || activityData.length === 0) return [];
    
    const hourStats: { [hour: number]: number } = {};
    activityData.forEach(item => {
      const date = new Date(item.date);
      const hour = date.getHours();
      hourStats[hour] = (hourStats[hour] || 0) + item.count;
    });

    // Находим максимальное значение
    const maxHourValue = Math.max(...Object.values(hourStats), 0);
    if (maxHourValue === 0) return [];

    // Находим все часы с максимальной активностью
    const peaks = Object.entries(hourStats)
      .filter(([_, count]) => count === maxHourValue)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        count: count,
      }))
      .sort((a, b) => a.hour - b.hour);

    return peaks;
  }, [activityData, period]);

  // Пик активности (максимальное количество запросов)
  const peakActivity = useMemo(() => {
    if (activityData.length === 0) return null;
    
    const maxItem = activityData.reduce((max, item) => 
      item.count > max.count ? item : max
    , activityData[0]);

    const date = new Date(maxItem.date);
    let timeLabel = '';
    
    if (period === 'day') {
      timeLabel = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (period === 'week') {
      timeLabel = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' });
    } else if (period === 'month') {
      timeLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    } else {
      timeLabel = date.toLocaleDateString('ru-RU', { month: 'long', day: 'numeric' });
    }

    return {
      count: maxItem.count,
      time: timeLabel,
      date: maxItem.date,
    };
  }, [activityData, period]);

  return (
    <div className="efficiency-analytics">
      <div className="efficiency-period-selector">
        <button
          className={`efficiency-period-btn ${period === 'day' ? 'active' : ''}`}
          onClick={() => setPeriod('day')}
        >
          День
        </button>
        <button
          className={`efficiency-period-btn ${period === 'week' ? 'active' : ''}`}
          onClick={() => setPeriod('week')}
        >
          Неделя
        </button>
        <button
          className={`efficiency-period-btn ${period === 'month' ? 'active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          Месяц
        </button>
        <button
          className={`efficiency-period-btn ${period === 'year' ? 'active' : ''}`}
          onClick={() => setPeriod('year')}
        >
          Год
        </button>
      </div>

      <div className="efficiency-stats">
        <div className="efficiency-stat-item">
          <div className="efficiency-stat-label">Всего активности</div>
          <div className="efficiency-stat-value">{getTotalActivity()}</div>
        </div>
        <div className="efficiency-stat-item">
          <div className="efficiency-stat-label">Средняя активность</div>
          <div className="efficiency-stat-value">{getAverageActivity()}</div>
        </div>
        <div className="efficiency-stat-item">
          <div className="efficiency-stat-label">Максимум за день</div>
          <div className="efficiency-stat-value">{maxValue}</div>
        </div>
        {peakActivity && (
          <div className="efficiency-stat-item">
            <div className="efficiency-stat-label">Пик активности</div>
            <div className="efficiency-stat-value">{peakActivity.count}</div>
            <div className="efficiency-stat-subtext">{peakActivity.time}</div>
          </div>
        )}
        {peakHours.length > 0 && (
          <div className="efficiency-stat-item">
            <div className="efficiency-stat-label">Пик по часам</div>
            <div className="efficiency-stat-value">{peakHours[0].count}</div>
            <div className="efficiency-stat-subtext">
              {peakHours.map(p => `${p.hour}:00`).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Heatmap таблица активности */}
      <div className="efficiency-chart">
        {period === 'year' && groupedByWeek ? (
          <div className="efficiency-year-chart">
            <div className="efficiency-year-grid">
              {/* Дни недели слева */}
              <div className="efficiency-weekdays">
                <div className="efficiency-weekday">Пн</div>
                <div className="efficiency-weekday"></div>
                <div className="efficiency-weekday">Ср</div>
                <div className="efficiency-weekday"></div>
                <div className="efficiency-weekday">Пт</div>
                <div className="efficiency-weekday"></div>
                <div className="efficiency-weekday"></div>
              </div>
              
              {/* График по неделям */}
              <div className="efficiency-weeks-container">
                <div className="efficiency-months">
                  {monthLabels.map(({ month, weekIndex }) => (
                    <div
                      key={`${month}-${weekIndex}`}
                      className="efficiency-month"
                      style={{ left: `${weekIndex * 16}px` }}
                    >
                      {month}
                    </div>
                  ))}
                </div>
                <div className="efficiency-weeks-grid">
                  {groupedByWeek.map((weekData, weekIndex) => (
                    <div key={weekIndex} className="efficiency-week-column">
                      {weekData.map((dayData, dayIndex) => {
                        const intensity = getIntensity(dayData.count);
                        const date = new Date(dayData.date);
                        return (
                          <div
                            key={dayIndex}
                            className={`efficiency-chart-cell intensity-${intensity}`}
                            title={`${date.toLocaleDateString('ru-RU')}: ${dayData.count} сообщений`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="efficiency-chart-grid"
            style={{
              gridTemplateColumns: period === 'week' 
                ? 'repeat(7, 12px)' 
                : period === 'month' 
                ? 'repeat(30, 12px)' 
                : undefined
            }}
          >
            {activityData.map((item, index) => {
              const intensity = getIntensity(item.count);
              return (
                <div
                  key={index}
                  className={`efficiency-chart-cell intensity-${intensity}`}
                  title={`${formatDate(item.date, period)}: ${item.count} сообщений`}
                />
              );
            })}
          </div>
        )}
        <div className="efficiency-chart-legend">
          <span className="efficiency-legend-label">Меньше</span>
          <div className="efficiency-legend-colors">
            <div className="efficiency-legend-color intensity-0" />
            <div className="efficiency-legend-color intensity-1" />
            <div className="efficiency-legend-color intensity-2" />
            <div className="efficiency-legend-color intensity-3" />
            <div className="efficiency-legend-color intensity-4" />
          </div>
          <span className="efficiency-legend-label">Больше</span>
        </div>
      </div>

      {/* Линейный график тренда */}
      {lineChartData.length > 0 && (
        <div className="efficiency-line-chart-container">
          <h3 className="efficiency-chart-title">Тренд активности</h3>
          <div className="efficiency-line-chart">
            <svg viewBox={`0 0 ${Math.max(400, lineChartData.length * 20)} 200`} className="efficiency-line-chart-svg">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Сетка */}
              {[0, 1, 2, 3, 4].map(i => {
                const y = 40 + (i * 40);
                return (
                  <line
                    key={`grid-${i}`}
                    x1="40"
                    y1={y}
                    x2={Math.max(400, lineChartData.length * 20)}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />
                );
              })}
              {/* Область под графиком */}
              {lineChartData.length > 1 && (
                <path
                  d={`M 40 ${180 - (lineChartData[0].y / maxValue) * 140} ${lineChartData.map((point, i) => 
                    `L ${40 + (i * (Math.max(400, lineChartData.length * 20) - 80) / (lineChartData.length - 1))} ${180 - (point.y / maxValue) * 140}`
                  ).join(' ')} L ${40 + (lineChartData.length - 1) * (Math.max(400, lineChartData.length * 20) - 80) / (lineChartData.length - 1)} 180 L 40 180 Z`}
                  fill="url(#lineGradient)"
                />
              )}
              {/* Линия графика */}
              {lineChartData.length > 1 && (
                <polyline
                  points={lineChartData.map((point, i) => 
                    `${40 + (i * (Math.max(400, lineChartData.length * 20) - 80) / (lineChartData.length - 1))},${180 - (point.y / maxValue) * 140}`
                  ).join(' ')}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Точки на графике */}
              {lineChartData.map((point, i) => {
                const isPeak = peakActivity && point.date === peakActivity.date;
                const isPeakHour = period === 'day' && peakHours.some(p => {
                  const pointDate = new Date(point.date);
                  return pointDate.getHours() === p.hour;
                });
                
                return (
                  <circle
                    key={i}
                    cx={40 + (i * (Math.max(400, lineChartData.length * 20) - 80) / Math.max(1, lineChartData.length - 1))}
                    cy={180 - (point.y / maxValue) * 140}
                    r={isPeak || isPeakHour ? "6" : "4"}
                    fill={isPeak || isPeakHour ? "#39d353" : "var(--color-primary)"}
                    className="efficiency-line-point"
                    style={isPeak || isPeakHour ? { filter: 'drop-shadow(0 0 4px #39d353)' } : {}}
                  />
                );
              })}
              {/* Подсветка пиков */}
              {lineChartData.map((point, i) => {
                const isPeak = peakActivity && point.date === peakActivity.date;
                const isPeakHour = period === 'day' && peakHours.some(p => {
                  const pointDate = new Date(point.date);
                  return pointDate.getHours() === p.hour;
                });
                
                if (!isPeak && !isPeakHour) return null;
                
                return (
                  <circle
                    key={`peak-${i}`}
                    cx={40 + (i * (Math.max(400, lineChartData.length * 20) - 80) / Math.max(1, lineChartData.length - 1))}
                    cy={180 - (point.y / maxValue) * 140}
                    r="8"
                    fill="none"
                    stroke="#39d353"
                    strokeWidth="2"
                    opacity="0.5"
                    className="efficiency-peak-indicator"
                  />
                );
              })}
              {/* Подписи осей */}
              {lineChartData.map((point, i) => {
                const step = Math.max(1, Math.floor(lineChartData.length / 6));
                if (i % step === 0 || i === lineChartData.length - 1) {
                  const date = new Date(point.date);
                  let label = '';
                  if (period === 'day') {
                    label = date.toLocaleTimeString('ru-RU', { hour: '2-digit' });
                  } else if (period === 'week') {
                    label = date.toLocaleDateString('ru-RU', { weekday: 'short' });
                  } else if (period === 'month') {
                    label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  } else if (period === 'year') {
                    label = date.toLocaleDateString('ru-RU', { month: 'short' });
                  }
                  return (
                    <text
                      key={`label-${i}`}
                      x={40 + (i * (Math.max(400, lineChartData.length * 20) - 80) / Math.max(1, lineChartData.length - 1))}
                      y="195"
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--color-text-secondary)"
                    >
                      {label}
                    </text>
                  );
                }
                return null;
              })}
              {/* Подписи значений на оси Y */}
              {[0, 1, 2, 3, 4].map(i => {
                const value = Math.round((maxValue / 4) * (4 - i));
                return (
                  <text
                    key={`y-label-${i}`}
                    x="35"
                    y={40 + (i * 40) + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--color-text-secondary)"
                  >
                    {value}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Столбчатая диаграмма по дням недели */}
      {(period === 'week' || period === 'month') && barChartData.length > 0 && (
        <div className="efficiency-bar-chart-container">
          <h3 className="efficiency-chart-title">Активность по дням недели</h3>
          <div className="efficiency-bar-chart">
            {barChartData.map((item, index) => {
              const barHeight = maxBarValue > 0 ? (item.value / maxBarValue) * 100 : 0;
              return (
                <div key={index} className="efficiency-bar-item">
                  <div className="efficiency-bar-wrapper">
                    <div
                      className="efficiency-bar"
                      style={{ height: `${barHeight}%` }}
                      title={`${item.label}: ${item.value} сообщений`}
                    />
                  </div>
                  <div className="efficiency-bar-label">{item.label}</div>
                  {item.value > 0 && (
                    <div className="efficiency-bar-value">{item.value}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

