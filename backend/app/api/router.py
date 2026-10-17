from fastapi import APIRouter

from app.api.routes import demo, guest, health, menu, payments, staff

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(menu.router)
api_router.include_router(menu.staff)
api_router.include_router(guest.router)
api_router.include_router(staff.router)
api_router.include_router(payments.router)
api_router.include_router(demo.router)
