from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Инициализируем БД при старте (применяет миграции)
try:
    from backend.app.database.connection import init_db
    print("🔄 Применение миграций базы данных...")
    init_db()
except Exception as e:
    print(f"⚠️ Ошибка инициализации БД: {e}")
    import traceback
    traceback.print_exc()

app = FastAPI(
    title="Business Assistant API",
    description="AI помощник для бизнес-консультаций",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем статические файлы из static
import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Подключаем статические файлы из assets (графики)
assets_dir = os.path.join(os.path.dirname(__file__), "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Импортируем и подключаем роуты с префиксом /api
try:
    from backend.app.routes.chat_routes import router as chat_router
    from backend.app.routes.auth_routes import router as auth_router
    from backend.app.routes.user_routes import router as user_router
    from backend.app.routes.notes_routes import router as notes_router
    from backend.app.routes.support_routes import router as support_router
    from backend.app.routes.spaces_routes import router as spaces_router
    from backend.app.routes.search_routes import router as search_router
    from backend.app.routes.notification_routes import router as notification_router
    from backend.app.routes.public_routes import router as public_router
    
    app.include_router(chat_router, prefix="/api", tags=["chat"])
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(user_router, prefix="/api/user", tags=["user"])
    app.include_router(notes_router, prefix="/api/notes", tags=["notes"])
    app.include_router(support_router, prefix="/api/support", tags=["support"])
    app.include_router(spaces_router, prefix="/api/spaces", tags=["spaces"])
    app.include_router(search_router, prefix="/api/search", tags=["search"])
    app.include_router(notification_router, prefix="/api/notifications", tags=["notifications"])
    app.include_router(public_router, prefix="/api/public", tags=["public"])
    
    print("✅ Роуты успешно подключены с префиксом /api")
except Exception as e:
    print(f"❌ Ошибка подключения роутов: {e}")
    import traceback
    traceback.print_exc()

@app.get("/")
async def serve_frontend():
    """Главная страница - веб-интерфейс"""
    import os
    static_html = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(static_html):
        return FileResponse(static_html)
    return {"message": "Frontend not found"}

@app.get("/api/health")
async def health_check():
    """Проверка здоровья приложения"""
    return {"status": "healthy", "message": "Business Assistant is running"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Запуск Business Assistant...")
    print("🌐 Веб-интерфейс: http://localhost:8000")
    print("📖 Документация API: http://localhost:8000/api/docs")
    print("🔧 API endpoints: http://localhost:8000/api/*")
    uvicorn.run(app, host="0.0.0.0", port=8000)

