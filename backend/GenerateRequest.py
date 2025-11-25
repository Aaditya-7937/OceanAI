from pydantic import BaseModel
from ProjectMeta import ProjectMeta
from typing import Optional

class GenerateRequest(BaseModel):
    projects: ProjectMeta
    user_id: Optional[str] = None
    hints: Optional[dict] = None