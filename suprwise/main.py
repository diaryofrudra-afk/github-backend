from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db, close_db
from .auth.router import router as auth_router
from .cranes.router import router as cranes_router
from .operators.router import router as operators_router
from .fuel.router import router as fuel_router
from .cameras.router import router as cameras_router
from .clients.router import router as clients_router
from .billing.router import router as billing_router
from .timesheets.router import router as timesheets_router
from .compliance.router import router as compliance_router
from .maintenance.router import router as maintenance_router
from .files.router import router as files_router
from .notifications.router import router as notifications_router
from .diagnostics.router import router as diagnostics_router
from .owner_profile.router import router as owner_profile_router
from .tenants.router import router as tenants_router
from .sync.router import router as sync_router
from .vehicle_lookup.router import router as vehicle_lookup_router
from .gps.router import router as gps_router
from .trakntell.router import router as trakntell_router
from .sms_otp.router import router as sms_otp_router
from .attendance.router import router as attendance_router
from .engine_status.router import router as engine_status_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Suprwise API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cranes_router)
app.include_router(operators_router)
app.include_router(fuel_router)
app.include_router(cameras_router)
app.include_router(clients_router)
app.include_router(billing_router)
app.include_router(timesheets_router)
app.include_router(compliance_router)
app.include_router(maintenance_router)
app.include_router(files_router)
app.include_router(notifications_router)
app.include_router(diagnostics_router)
app.include_router(owner_profile_router)
app.include_router(tenants_router)
app.include_router(sync_router)
app.include_router(vehicle_lookup_router)
app.include_router(gps_router)
app.include_router(trakntell_router)
app.include_router(sms_otp_router)
app.include_router(attendance_router)
app.include_router(engine_status_router)


@app.get("/")
async def root():
    return {"message": "Suprwise Backend API is running", "docs": "/docs"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}
