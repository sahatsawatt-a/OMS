from fastapi import APIRouter

from app.api.routes import demo, floor, guest, health, live, menu, payments, staff

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(menu.router)
api_router.include_router(menu.admin)
api_router.include_router(menu.staff)
api_router.include_router(guest.router)
api_router.include_router(staff.router)
api_router.include_router(payments.router)
api_router.include_router(demo.router)
api_router.include_router(floor.router)
api_router.include_router(floor.admin)
api_router.include_router(live.router)
