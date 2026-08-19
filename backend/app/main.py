import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import Base, engine
from app.api.auth import router as auth_router
from app.api.master import router as master_router
from app.api.submissions import router as submissions_router
from app.api.bookings import router as bookings_router
from app.api.reports import router as reports_router
from app.api.audit import router as audit_router
from app.api.dashboard import router as dashboard_router
from app.api.notify import router as notify_router
from app.seeds.seed_master_data import seed_database
from app.seeds.migrate_real_excel_data import migrate_real_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.join(settings.STORAGE_PATH, "reports"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "signatures"), exist_ok=True)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ISO 15189 Compliant Laboratory Information System for Microbiology Environmental Reporting (Thammasat University Hospital)",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Storage for generated PDF reports
storage_dir = os.path.abspath(settings.STORAGE_PATH)
os.makedirs(storage_dir, exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_dir), name="storage")

# Include API Routers
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(master_router, prefix=api_prefix)
app.include_router(submissions_router, prefix=api_prefix)
app.include_router(bookings_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(notify_router, prefix=api_prefix)
app.include_router(notify_router, prefix="/api")

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }

# Find frontend directory
possible_frontend_paths = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend")),
    os.path.abspath("./frontend"),
]

frontend_dir = None
for p in possible_frontend_paths:
    if os.path.exists(p) and os.path.exists(os.path.join(p, "index.html")):
        frontend_dir = p
        break

if frontend_dir:
    css_dir = os.path.join(frontend_dir, "css")
    js_dir = os.path.join(frontend_dir, "js")
    assets_dir = os.path.join(frontend_dir, "assets")
    images_dir = os.path.join(frontend_dir, "images")

    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.exists(images_dir):
        app.mount("/images", StaticFiles(directory=images_dir), name="images")

    # Favicon & Brand Icon routes
    @app.get("/favicon.ico", include_in_schema=False)
    def serve_favicon_ico():
        fav_path = os.path.join(frontend_dir, "favicon.ico")
        if os.path.exists(fav_path):
            return FileResponse(fav_path)
        return FileResponse(os.path.join(frontend_dir, "images", "tuh-logo.png"))

    @app.get("/favicon.png", include_in_schema=False)
    def serve_favicon_png():
        fav_path = os.path.join(frontend_dir, "favicon.png")
        if os.path.exists(fav_path):
            return FileResponse(fav_path)
        return FileResponse(os.path.join(frontend_dir, "images", "tuh-logo.png"))

    # Serve index.html as default landing root
    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/index.html", include_in_schema=False)
    def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/dashboard.html", include_in_schema=False)
    def serve_dashboard():
        return FileResponse(os.path.join(frontend_dir, "dashboard.html"))

    @app.get("/report_view.html", include_in_schema=False)
    def serve_report_view():
        return FileResponse(os.path.join(frontend_dir, "report_view.html"))

    @app.get("/login.html", include_in_schema=False)
    def serve_login():
        return FileResponse(os.path.join(frontend_dir, "login.html"))

    @app.get("/air.html", include_in_schema=False)
    def serve_air():
        return FileResponse(os.path.join(frontend_dir, "air.html"))

    @app.get("/booking.html", include_in_schema=False)
    def serve_booking():
        return FileResponse(os.path.join(frontend_dir, "booking.html"))

    @app.get("/workflow.html", include_in_schema=False)
    def serve_workflow():
        return FileResponse(os.path.join(frontend_dir, "workflow.html"))

    @app.get("/admin.html", include_in_schema=False)
    def serve_admin():
        return FileResponse(os.path.join(frontend_dir, "admin.html"))

    @app.get("/audit.html", include_in_schema=False)
    def serve_audit():
        return FileResponse(os.path.join(frontend_dir, "audit.html"))
