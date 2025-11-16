# Frontend

Фронтенд приложение для ИИ-ассистента на 
## Структура проекта

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── ChatArea/
│   │   └── ui/
│   │       ├── Button/
│   │       ├── Input/
│   │       └── Icon/
│   ├── pages/
│   │   └── AssistantPage/
│   ├── styles/
│   │   ├── globals.css
│   │   └── variables.css
│   ├── utils/
│   │   └── icons.ts
│   ├── types/
│   │   └── index.ts
│   └── assets/
│       └── icons/
├── public/
└── package.json
```

## Установка и запуск

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev
```

## Особенности

- React 18 с TypeScript
- Vite для быстрой разработки
- Модульная структура компонентов
- CSS переменные для темизации
- Адаптивный дизайн
- Hover-эффекты и анимации
- Иконки из hugeicons.com

## Компоненты

### UI компоненты
- **Icon** - компонент для отображения SVG иконок с поддержкой размеров и цветов
- **Button** - кнопка с вариантами стилей (primary, secondary, ghost)
- **Input** - поле ввода с поддержкой иконок

### Common компоненты
- **Sidebar** - боковая панель с навигацией и списком чатов
- **Header** - заголовок страницы
- **ChatArea** - область чата с сообщениями и вводом

### Страницы
- **AssistantPage** - главная страница ИИ-ассистента
