from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

app = FastAPI(
    title="Business Assistant API",
    description="AI помощник для бизнес-консультаций",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем статические файлы из templates
app.mount("/static", StaticFiles(directory="templates"), name="static")

# Импортируем и подключаем роуты с префиксом /api
try:
    from routes.chat_routes import router
    app.include_router(router, prefix="/api")
    print("✅ Роуты успешно подключены с префиксом /api")
except Exception as e:
    print(f"❌ Ошибка подключения роутов: {e}")

@app.get("/")
async def serve_frontend():
    """Главная страница - веб-интерфейс"""
    return FileResponse('templates/index.html')

@app.get("/health")
async def health_check():
    """Проверка здоровья приложения"""
    return {"status": "healthy", "message": "Business Assistant is running"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Запуск Business Assistant...")
    print("🌐 Веб-интерфейс: http://localhost:8000")
    print("📖 Документация API: http://localhost:8000/docs")
    print("🔧 API endpoints: http://localhost:8000/api/*")
    uvicorn.run(app, host="0.0.0.0", port=8000)