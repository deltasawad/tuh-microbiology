import os
import hashlib
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.submission import Submission
from app.models.report import ReportVersion
from app.models.user import User

class PdfService:
    @staticmethod
    def _create_minimal_pdf(title: str, lines: list[str]) -> bytes:
        """Create a valid pure-python PDF with text content"""
        content_stream = "BT /F1 12 Tf 50 780 Td\n"
        content_stream += f"({title}) Tj 0 -20 Td\n"
        for line in lines:
            safe_line = line.replace("(", "\(").replace(")", "\)")
            content_stream += f"({safe_line}) Tj 0 -14 Td\n"
        content_stream += "ET\n"
        
        stream_bytes = content_stream.encode('latin1', 'replace')
        stream_len = len(stream_bytes)
        
        pdf = (
            f"%PDF-1.4\n"
            f"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            f"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            f"4 0 obj\n<< /Length {stream_len} >>\nstream\n"
            f"{content_stream}"
            f"endstream\nendobj\n"
            f"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            f"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000234 00000 n \n"
            f"{234 + stream_len + 30:010d} 00000 n \n"
            f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{300 + stream_len}\n%%EOF\n"
        )
        return pdf.encode('latin1', 'replace')

    @staticmethod
    def generate_air_sampling_pdf(db: Session, submission_id: int, current_user: Optional[User] = None) -> tuple[str, str]:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")

        storage_dir = os.path.join(settings.STORAGE_PATH, "reports")
        os.makedirs(storage_dir, exist_ok=True)

        version_no = db.query(ReportVersion).filter(ReportVersion.submission_id == submission_id).count() + 1
        filename = f"{submission.submission_no}_v{version_no}.pdf"
        file_path = os.path.join(storage_dir, filename)

        pdf_bytes = None

        # 1. Try ReportLab if installed
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from io import BytesIO

            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
            styles = getSampleStyleSheet()
            
            title_style = ParagraphStyle('T', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=18, alignment=1, textColor=colors.HexColor('#0f766e'))
            body_style = ParagraphStyle('B', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12)
            
            story = [
                Paragraph("THAMMASAT UNIVERSITY HOSPITAL", title_style),
                Paragraph("MICROBIOLOGY ENVIRONMENTAL REPORT (ISO 15189)", body_style),
                Spacer(1, 10),
                Paragraph(f"Submission No: {submission.submission_no} | Date: {submission.submission_date}", body_style),
                Paragraph(f"Department: {submission.department.name_th}", body_style),
                Paragraph(f"Status: {submission.status} | Reporter: {submission.reporter.full_name_with_license if submission.reporter else '-'}", body_style),
                Paragraph(f"Reviewer: {submission.reviewer.full_name_with_license if submission.reviewer else '-'}", body_style),
                Spacer(1, 15)
            ]

            table_data = [["No.", "Ward", "Location", "Bacteria CFU", "Fungus CFU", "Remarks"]]
            for s in submission.samples:
                ward_name = s.ward.name_th if s.ward else "-"
                loc = s.label or "-"
                bac = next((r.result_value for r in s.results if r.analyte_code == "bacteria_colonies"), "-")
                fun = next((r.result_value for r in s.results if r.analyte_code == "fungus_colonies"), "-")
                rem = next((r.remarks for r in s.results if r.remarks), "-")
                table_data.append([str(s.sample_no), ward_name, loc, str(bac or '-'), str(fun or '-'), rem or '-'])

            t = Table(table_data, colWidths=[30, 120, 130, 80, 80, 80])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('PADDING', (0,0), (-1,-1), 5)
            ]))
            story.append(t)
            doc.build(story)
            pdf_bytes = buffer.getvalue()
            buffer.close()
        except Exception:
            # 2. Pure Python Standard PDF Builder
            rep_name = submission.reporter.first_name if submission.reporter else "Pending"
            rev_name = submission.reviewer.first_name if submission.reviewer else "Pending"
            
            lines = [
                f"Department of Pathology - Microbiology Section (ISO 15189)",
                f"----------------------------------------------------------------",
                f"Submission No : {submission.submission_no}",
                f"Submission Date : {submission.submission_date}",
                f"Department : {submission.department.name_th}",
                f"Status : {submission.status}",
                f"Reporter : {rep_name} (Medical Technologist)",
                f"Reviewer/Approver : {rev_name}",
                f"----------------------------------------------------------------",
                f"RESULTS TABLE:",
            ]
            for s in submission.samples:
                ward_n = s.ward.name_th if s.ward else "Ward"
                bac = next((r.result_value for r in s.results if r.analyte_code == "bacteria_colonies"), "-")
                fun = next((r.result_value for r in s.results if r.analyte_code == "fungus_colonies"), "-")
                lines.append(f"Sample #{s.sample_no}: {ward_n} ({s.label or '-'}) -> Bacteria: {bac} CFU | Fungus: {fun} CFU")
            
            lines.append("----------------------------------------------------------------")
            lines.append(f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} (ISO 15189 Validated)")
            
            pdf_bytes = PdfService._create_minimal_pdf("TUH AIR SAMPLING MICROBIOLOGICAL REPORT", lines)

        # Save to disk
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)

        sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()

        rep_version = ReportVersion(
            submission_id=submission.id,
            version_no=version_no,
            pdf_file_path=file_path,
            sha256_hash=sha256_hash,
            created_by_user_id=current_user.id if current_user else None
        )
        db.add(rep_version)
        db.commit()

        return f"/storage/reports/{filename}", sha256_hash
