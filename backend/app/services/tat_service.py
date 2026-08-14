from datetime import datetime
from typing import Dict, Optional, List
from app.models.status_transition import StatusTransition

class TatService:
    @staticmethod
    def calculate_tat(transitions: List[StatusTransition]) -> Dict[str, Optional[float]]:
        """
        Calculate TAT stages in hours from status transitions:
        - submitted_to_received: time between SUBMITTED and RECEIVED
        - received_to_inprogress: time between RECEIVED and IN_PROGRESS
        - inprogress_to_completed: time between IN_PROGRESS and COMPLETED
        - completed_to_reported: time between COMPLETED and REPORTED
        - total_tat_hours: total time from SUBMITTED to REPORTED
        """
        timestamps: Dict[str, datetime] = {}
        for t in transitions:
            if t.to_status not in timestamps:
                timestamps[t.to_status] = t.transitioned_at
                
        t_sub = timestamps.get("SUBMITTED")
        t_rec = timestamps.get("RECEIVED")
        t_inp = timestamps.get("IN_PROGRESS")
        t_com = timestamps.get("COMPLETED")
        t_rep = timestamps.get("REPORTED")

        def diff_hours(t1: Optional[datetime], t2: Optional[datetime]) -> Optional[float]:
            if t1 and t2 and t2 >= t1:
                return round((t2 - t1).total_seconds() / 3600.0, 2)
            return None

        return {
            "submitted_to_received_hours": diff_hours(t_sub, t_rec),
            "received_to_inprogress_hours": diff_hours(t_rec, t_inp),
            "inprogress_to_completed_hours": diff_hours(t_inp, t_com),
            "completed_to_reported_hours": diff_hours(t_com, t_rep),
            "total_tat_hours": diff_hours(t_sub, t_rep or t_com)
        }
