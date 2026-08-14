from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_optional_user, require_roles
from app.models.booking import Booking
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse

router = APIRouter(prefix="/bookings", tags=["Specimen Queue Bookings"])

@router.get("", response_model=List[BookingResponse])
def list_bookings(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    test_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Booking)
    if start_date:
        query = query.filter(Booking.booking_date >= start_date)
    if end_date:
        query = query.filter(Booking.booking_date <= end_date)
    if test_type:
        query = query.filter(Booking.test_type == test_type)
    if status:
        query = query.filter(Booking.status == status)
        
    return query.order_by(Booking.booking_date.asc()).all()

@router.post("", response_model=BookingResponse)
def create_booking(data: BookingCreate, db: Session = Depends(get_db)):
    booking = Booking(
        booking_date=data.booking_date,
        test_type=data.test_type,
        department_id=data.department_id,
        department_name=data.department_name,
        full_name=data.full_name,
        contact_number=data.contact_number,
        sample_count=data.sample_count,
        remarks=data.remarks,
        status="CONFIRMED"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    data: BookingUpdate,
    current_user: User = Depends(require_roles(["technician", "approver", "admin"])),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(booking, k, v)
        
    db.commit()
    db.refresh(booking)
    return booking

@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    current_user: User = Depends(require_roles(["technician", "approver", "admin"])),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    db.delete(booking)
    db.commit()
    return {"message": "Booking deleted successfully"}
