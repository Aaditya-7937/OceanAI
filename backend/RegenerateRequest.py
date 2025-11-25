from pydantic import BaseModel
from ProjectMeta import ProjectMeta

class RegenerateRequest(BaseModel):
    item_id: str
    project: ProjectMeta
    feedback_text: str
    