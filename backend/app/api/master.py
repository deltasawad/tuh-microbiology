from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.master import Service, Department, Ward, Staff, Organism, ReferenceRange
from app.schemas.master import (
    ServiceResponse, DepartmentResponse, WardResponse, StaffResponse, OrganismResponse, ReferenceRangeResponse
)

router = APIRouter(prefix="/master", tags=["Master Data"])

@router.get("/services", response_model=List[ServiceResponse])
def get_services(db: Session = Depends(get_db)):
    return db.query(Service).filter(Service.is_active == True).order_by(Service.code).all()

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).filter(Department.is_active == True).order_by(Department.name_th).all()

@router.get("/wards", response_model=List[WardResponse])
def get_wards(db: Session = Depends(get_db)):
    return db.query(Ward).filter(Ward.is_active == True).order_by(Ward.name_th).all()

@router.get("/staff", response_model=List[StaffResponse])
def get_staff(db: Session = Depends(get_db)):
    return db.query(Staff).filter(Staff.is_active == True).order_by(Staff.id).all()

@router.get("/organisms", response_model=List[OrganismResponse])
def get_organisms(db: Session = Depends(get_db)):
    return db.query(Organism).filter(Organism.is_active == True).order_by(Organism.id).all()

@router.get("/reference-ranges", response_model=List[ReferenceRangeResponse])
def get_reference_ranges(service_id: int = None, db: Session = Depends(get_db)):
    query = db.query(ReferenceRange)
    if service_id:
        query = query.filter(ReferenceRange.service_id == service_id)
    return query.all()

@router.get("/holidays")
def get_holidays():
    return [
        {"date": "01-01", "name": "วันขึ้นปีใหม่"},
        {"date": "02-24", "name": "วันมาฆบูชา (ชดเชย)"},
        {"date": "04-06", "name": "วันจักรี"},
        {"date": "04-08", "name": "วันจักรี (ชดเชย)"},
        {"date": "04-13", "name": "วันสงกรานต์"},
        {"date": "04-14", "name": "วันสงกรานต์"},
        {"date": "04-15", "name": "วันสงกรานต์"},
        {"date": "05-01", "name": "วันแรงงานแห่งชาติ"},
        {"date": "05-04", "name": "วันฉัตรมงคล"},
        {"date": "05-05", "name": "วันฉัตรมงคล (ชดเชย)"},
        {"date": "05-22", "name": "วันวิสาขบูชา"},
        {"date": "06-03", "name": "วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี"},
        {"date": "07-28", "name": "วันเฉลิมพระชนมพรรษา ร.10"},
        {"date": "07-29", "name": "วันเฉลิมพระชนมพรรษา ร.10 (ชดเชย)"},
        {"date": "08-12", "name": "วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่"},
        {"date": "10-13", "name": "วันนวมินทรมหาราช"},
        {"date": "10-14", "name": "วันนวมินทรมหาราช (ชดเชย)"},
        {"date": "10-23", "name": "วันปิยมหาราช"},
        {"date": "12-05", "name": "วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ"},
        {"date": "12-10", "name": "วันรัฐธรรมนูญ"},
        {"date": "12-31", "name": "วันสิ้นปี"}
    ]
